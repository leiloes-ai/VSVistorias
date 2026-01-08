import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../contexts/AppContext.tsx';
import { Appointment, AppointmentStatus } from '../types.ts';
import { AddIcon, EditIcon, DeleteIcon, SearchIcon, DownloadIcon } from '../components/Icons.tsx';
import Modal from '../components/Modal.tsx';
import ConfirmationDialog from '../components/ConfirmationDialog.tsx';
import AppointmentForm from '../components/AppointmentForm.tsx';
import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Appointments: React.FC = () => {
  const { user, users, appointments, deleteAppointment, loading, isOnline, updateAppointment, settings, logo } = useContext(AppContext);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isEditConfirmOpen, setIsEditConfirmOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [appointmentToAction, setAppointmentToAction] = useState<Appointment | null>(null);
  
  const [searchByDate, setSearchByDate] = useState(false);
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });


  const canCreateOrDelete = user?.permissions.appointments === 'edit';
  const canUpdate = user?.permissions.appointments === 'edit' || user?.permissions.appointments === 'update';
  const isAdminOrMaster = useMemo(() => user?.roles.includes('master') || user?.roles.includes('admin'), [user]);
  const isAdminOrMasterOrClient = useMemo(() => user?.roles.includes('master') || user?.roles.includes('admin') || user?.roles.includes('client'), [user]);

  const getInspectorName = (inspectorId: string) => {
    const inspector = users.find(u => u.id === inspectorId);
    return inspector ? inspector.name : 'Não atribuído';
  }

  const userAppointments = useMemo(() => {
    if (!user) return [];
    
    let baseAppointments: Appointment[];

    if (user.roles.includes('master') || user.roles.includes('admin')) {
        baseAppointments = appointments.filter(app => app.status !== 'Solicitado');
    } else {
        const visibleAppointments = new Map<string, Appointment>();

        if (user.roles.includes('client') && user.requesterId) {
            const clientRequester = settings.requesters.find(r => r.id === user.requesterId);
            if (clientRequester) {
                appointments
                    .filter(app => app.requester.toLowerCase() === clientRequester.name.toLowerCase())
                    .forEach(app => visibleAppointments.set(app.stringId!, app));
            }
        }
        
        if (user.roles.includes('inspector')) {
            appointments
                .filter(app => 
                    app.inspectorId === user.id && 
                    app.status !== 'Solicitado' && 
                    app.status !== 'Concluído' && 
                    app.status !== 'Finalizado'
                )
                .forEach(app => visibleAppointments.set(app.stringId!, app));
        }
        baseAppointments = Array.from(visibleAppointments.values());
    }
    
    let finalAppointments: Appointment[];

    if (isAdminOrMasterOrClient) {
        if (searchByDate) {
            let dateFilteredAppointments = [...baseAppointments];
            if (dateFilter.start) {
                const startDate = new Date(dateFilter.start + 'T00:00:00');
                dateFilteredAppointments = dateFilteredAppointments.filter(app => new Date(app.date + 'T00:00:00') >= startDate);
            }
            if (dateFilter.end) {
                const endDate = new Date(dateFilter.end + 'T23:59:59');
                dateFilteredAppointments = dateFilteredAppointments.filter(app => new Date(app.date + 'T00:00:00') <= endDate);
            }
            finalAppointments = dateFilteredAppointments;
        } else {
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
            threeDaysAgo.setHours(0, 0, 0, 0);

            finalAppointments = baseAppointments.filter(app => {
                const isCompleted = app.status === 'Concluído' || app.status === 'Finalizado';
                if (!isCompleted) return true;
                const appDate = new Date(app.date + 'T00:00:00');
                return appDate >= threeDaysAgo;
            });
        }
    } else {
       finalAppointments = baseAppointments;
    }
    
    return finalAppointments.sort((a, b) => {
      const dateA = new Date(a.date + 'T00:00:00').getTime();
      const dateB = new Date(b.date + 'T00:00:00').getTime();
      if (dateA !== dateB) return dateA - dateB;
      const idA = a.displayId || (a.stringId ? `#${a.stringId.slice(-6).toUpperCase()}` : '');
      const idB = b.displayId || (b.stringId ? `#${b.stringId.slice(-6).toUpperCase()}` : '');
      return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
    });

  }, [user, appointments, settings.requesters, searchByDate, dateFilter, isAdminOrMasterOrClient]);
  
  const filteredAppointments = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return userAppointments.filter(app => {
        if (statusFilter !== 'Todos' && app.status !== statusFilter) return false;
        const inspectorName = getInspectorName(app.inspectorId).toLowerCase();
        const systemId = (app.stringId ? `#${app.stringId.slice(-6).toUpperCase()}` : String(app.id)).toLowerCase();
        return (
            (app.licensePlate || '').toLowerCase().includes(query) ||
            (app.description || '').toLowerCase().includes(query) ||
            (app.demand || '').toLowerCase().includes(query) ||
            (app.requester || '').toLowerCase().includes(query) ||
            inspectorName.includes(query) ||
            (app.displayId || '').toLowerCase().includes(query) ||
            systemId.includes(query)
        );
    });
  }, [userAppointments, searchQuery, users, statusFilter]);

  if (!user || user.permissions.appointments === 'hidden') {
    return (
        <div className="text-center p-10 bg-yellow-100 dark:bg-yellow-900 border-l-4 border-yellow-500 rounded-r-lg">
            <h2 className="text-xl font-bold text-yellow-800 dark:text-yellow-200">Acesso Negado</h2>
            <p className="mt-2 text-yellow-700 dark:text-yellow-300">Você não tem permissão para visualizar esta página.</p>
        </div>
    );
  }

  const openFormModal = (appointment: Appointment | null) => {
    setSelectedAppointment(appointment);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedAppointment(null);
  };
  
  const handleEditClick = (appointment: Appointment) => {
    setAppointmentToAction(appointment);
    setIsEditConfirmOpen(true);
  };

  const confirmEdit = () => {
    if (appointmentToAction) openFormModal(appointmentToAction);
    setIsEditConfirmOpen(false);
    setAppointmentToAction(null);
  };

  const handleDeleteClick = (appointment: Appointment) => {
    setAppointmentToAction(appointment);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (appointmentToAction && appointmentToAction.stringId) {
      deleteAppointment(appointmentToAction.stringId);
    }
    setIsDeleteConfirmOpen(false);
    setAppointmentToAction(null);
  };

  const handleStatusChange = (appointment: Appointment, newStatus: AppointmentStatus) => {
    updateAppointment({ ...appointment, status: newStatus });
  };
  
  const handleDateFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateFilter(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleToggleSearchByDate = (checked: boolean) => {
    setSearchByDate(checked);
    if (!checked) setDateFilter({ start: '', end: '' });
  };

  const handleExportExcel = () => {
    const dataToExport = filteredAppointments.map(app => ({
        'ID Vistoria': app.displayId || (app.stringId ? `#${app.stringId.slice(-6).toUpperCase()}` : app.id),
        'Solicitante': app.requester,
        'Demanda': app.demand,
        'Placa': app.licensePlate,
        'Descrição': app.description,
        'Tipo Vistoria': app.inspectionType,
        'Pátio': app.patio,
        'Data': new Date(app.date + 'T00:00:00').toLocaleDateString('pt-BR'),
        'Vistoriador': getInspectorName(app.inspectorId),
        'Status': app.status,
    }));
    const worksheet = utils.json_to_sheet(dataToExport);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, "Agendamentos");
    writeFile(workbook, `Vistorias_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPdf = () => {
      const doc = new jsPDF();
      doc.text(settings.appName, 14, 15);
      const tableRows = filteredAppointments.map(app => [
          app.displayId || app.licensePlate,
          app.requester,
          new Date(app.date + 'T00:00:00').toLocaleDateString('pt-BR'),
          app.status
      ]);
      autoTable(doc, { head: [['ID/Placa', 'Solicitante', 'Data', 'Status']], body: tableRows, startY: 25 });
      doc.save(`Vistorias_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Solicitado': return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
      case 'Agendado': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300';
      case 'Em Andamento': return 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300';
      case 'Concluído': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300';
      case 'Pendente': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300';
      case 'Finalizado': return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Agendamentos</h1>
            {!isOnline && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded-md animate-pulse">OFFLINE</span>}
          </div>
          <p className="mt-1 text-gray-600 dark:text-gray-400">Visualize e gerencie as vistorias agendadas.</p>
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-2 w-full sm:w-auto">
          {isAdminOrMasterOrClient && (
              <div className="flex justify-end gap-2">
                  <button onClick={handleExportExcel} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition-colors"><DownloadIcon />Excel</button>
                  <button onClick={handleExportPdf} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg shadow hover:bg-red-700 transition-colors"><DownloadIcon />PDF</button>
              </div>
          )}
          {canCreateOrDelete && (
            <button onClick={() => openFormModal(null)} className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg shadow hover:bg-primary-600 transition-colors font-semibold">
              <AddIcon /> Novo Agendamento
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg">
        <div className="flex flex-col lg:flex-row gap-4 mb-4 lg:items-center">
            <div className="relative flex-grow w-full">
                <input type="text" placeholder="Buscar por placa, solicitante, ID, etc..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} spellCheck="true" className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><SearchIcon /></div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
                    <option value="Todos">Todos os Status</option>
                    {settings.statuses.filter(s => s.name !== 'Solicitado' || !isAdminOrMaster).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
                
                {isAdminOrMasterOrClient && (
                    <div className="flex items-center gap-2 w-full">
                        <input type="checkbox" id="searchByDate" checked={searchByDate} onChange={(e) => handleToggleSearchByDate(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"/>
                        <label htmlFor="searchByDate" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Filtrar Período</label>
                        <input type="date" name="start" value={dateFilter.start} onChange={handleDateFilterChange} disabled={!searchByDate} className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm disabled:opacity-50" />
                        <span className="text-gray-500 text-sm">a</span>
                        <input type="date" name="end" value={dateFilter.end} onChange={handleDateFilterChange} disabled={!searchByDate} className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm disabled:opacity-50" />
                    </div>
                )}
            </div>
        </div>

        {loading ? <p className="text-center py-8">Carregando...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-white uppercase bg-primary-600">
                <tr>
                  <th className="px-2 py-3">Id</th><th className="px-2 py-3">Data</th><th className="px-2 py-3">Placa / Descrição</th><th className="px-2 py-3">Solicitante</th><th className="px-2 py-3">Pátio</th><th className="px-2 py-3">Vistoriador</th><th className="px-2 py-3">Status</th><th className="px-2 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map(app => (
                  <tr key={app.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                    <td className="px-2 py-2">{app.displayId || `#${app.stringId?.slice(-6).toUpperCase()}`}</td>
                    <td className="px-2 py-2">{new Date(app.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="px-2 py-2">
                        <div className="font-medium text-gray-900 dark:text-white">{app.licensePlate}</div>
                        <div className="text-xs truncate max-w-[150px]">{app.description}</div>
                    </td>
                    <td className="px-2 py-2">{app.requester}</td>
                    <td className="px-2 py-2">{app.patio}</td>
                    <td className="px-2 py-2">{getInspectorName(app.inspectorId)}</td>
                    <td className="px-2 py-2 min-w-[120px]">
                      <select
                          value={app.status}
                          onChange={(e) => handleStatusChange(app, e.target.value as AppointmentStatus)}
                          disabled={!canUpdate}
                          className={`w-full p-1.5 text-xs font-semibold rounded-md border-0 focus:ring-2 focus:ring-primary-500 ${getStatusColor(app.status)}`}
                      >
                          {settings.statuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2 flex justify-center gap-2">
                      <button onClick={() => handleEditClick(app)} disabled={!canUpdate} className="text-primary-500"><EditIcon /></button>
                      <button onClick={() => handleDeleteClick(app)} disabled={!canCreateOrDelete} className="text-red-500"><DeleteIcon /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredAppointments.length === 0 && <p className="text-center py-8 text-gray-500">Nenhum registro encontrado.</p>}
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={selectedAppointment ? 'Editar Agendamento' : 'Novo Agendamento'}>
        <AppointmentForm appointment={selectedAppointment} onSave={handleCloseModal} />
      </Modal>

      <ConfirmationDialog isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} onConfirm={confirmDelete} title="Confirmar Exclusão" message="Tem certeza que deseja excluir este agendamento?"/>
      <ConfirmationDialog isOpen={isEditConfirmOpen} onClose={() => setIsEditConfirmOpen(false)} onConfirm={confirmEdit} title="Editar Agendamento" message="Deseja prosseguir com a edição?" confirmButtonColor="blue" />
    </>
  );
};

export default Appointments;