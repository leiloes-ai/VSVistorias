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
  const { user, users, appointments, deleteAppointment, loading, updateAppointment, settings, logo } = useContext(AppContext);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isEditConfirmOpen, setIsEditConfirmOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [appointmentToAction, setAppointmentToAction] = useState<Appointment | null>(null);
  
  // State for the new date filtering functionality
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
                const endDate = new Date(dateFilter.end + 'T00:00:00');
                dateFilteredAppointments = dateFilteredAppointments.filter(app => new Date(app.date + 'T00:00:00') <= endDate);
            }
            finalAppointments = dateFilteredAppointments;
        } else {
            // Default view: hide completed older than 72 hours (3 days)
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
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) {
        return dateA - dateB;
      }

      // Secondary sort by the displayed ID, using a natural sort for alphanumeric values.
      const getDisplayableId = (app: Appointment): string => {
        return app.displayId || (app.stringId ? `#${app.stringId.slice(-6).toUpperCase()}` : '');
      };

      const idA = getDisplayableId(a);
      const idB = getDisplayableId(b);

      return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
    });

  }, [user, appointments, settings.requesters, searchByDate, dateFilter, isAdminOrMasterOrClient]);
  
  const filteredAppointments = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return userAppointments.filter(app => {
        // Status Filter
        if (statusFilter !== 'Todos' && app.status !== statusFilter) {
            return false;
        }

        // Search Query Filter
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
    if (appointmentToAction) {
      openFormModal(appointmentToAction);
    }
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
    if (!checked) {
      setDateFilter({ start: '', end: '' });
    }
  };

  const handleExportExcel = () => {
    const header = [
        [settings.appName],
        ["Relatório de Agendamentos"],
        []
    ];

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
        'Observação': app.notes,
    }));

    const worksheet = utils.aoa_to_sheet(header);
    utils.sheet_add_json(worksheet, dataToExport, {
        origin: 'A4',
        skipHeader: false,
    });
    
    // Set column widths
    worksheet['!cols'] = [ { wch: 12 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 30 } ];

    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, "Agendamentos");
    writeFile(workbook, `Agendamentos_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPdf = () => {
      const doc = new jsPDF();
      if (logo) {
        try {
            doc.addImage(logo, 'PNG', 14, 8, 20, 20);
        } catch (e) { console.error("Error adding logo to PDF:", e); }
      }
      doc.setFontSize(18);
      doc.text(settings.appName, 40, 15);
      doc.setFontSize(12);
      doc.text("Relatório de Agendamentos", 40, 22);

      const tableColumn = ["ID", "Solicitante", "Placa", "Data", "Vistoriador", "Status"];
      const tableRows: (string | number)[][] = [];

      filteredAppointments.forEach(app => {
          const appointmentData = [
              app.displayId || (app.stringId ? `#${app.stringId.slice(-6).toUpperCase()}` : app.id),
              app.requester,
              app.licensePlate,
              new Date(app.date + 'T00:00:00').toLocaleDateString('pt-BR'),
              getInspectorName(app.inspectorId),
              app.status,
          ];
          tableRows.push(appointmentData);
      });

      autoTable(doc, {
          head: [tableColumn],
          body: tableRows,
          startY: 35,
      });

      doc.save(`Agendamentos_${new Date().toISOString().split('T')[0]}.pdf`);
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

  const getBorderStatusColor = (status: string) => {
    switch (status) {
      case 'Agendado': return 'border-indigo-500';
      case 'Em Andamento': return 'border-sky-500';
      case 'Concluído': return 'border-emerald-500';
      case 'Pendente': return 'border-amber-500';
      case 'Finalizado': return 'border-teal-500';
      default: return 'border-gray-300 dark:border-gray-600';
    }
  };
  
  const renderLoading = () => (
    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
      <p>Carregando agendamentos do Firestore...</p>
    </div>
  );

  const renderCards = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
        {filteredAppointments.map(app => {
            const dateObj = new Date(app.date + 'T00:00:00');
            const fullDate = dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

            return (
                <div key={app.id} className={`bg-white dark:bg-gray-800 shadow-lg rounded-xl overflow-hidden border-l-4 ${getBorderStatusColor(app.status)} flex flex-col`}>
                    <div className="p-4 flex-grow">
                        {/* Header */}
                        <div>
                            <div className="flex justify-between items-baseline">
                                <p className="font-bold text-lg text-gray-800 dark:text-white leading-tight">{app.licensePlate || 'Sem Placa'}</p>
                                <p className="text-xs font-mono text-gray-500 dark:text-gray-400">{app.displayId || `#${app.stringId?.slice(-6).toUpperCase()}`}</p>
                            </div>
                            <p className="text-sm font-semibold text-primary-600 dark:text-primary-400 capitalize">{fullDate}</p>
                        </div>

                        {/* Details */}
                        <dl className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3 text-sm">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                <div>
                                    <dt className="font-semibold text-gray-700 dark:text-gray-300">Solicitante</dt>
                                    <dd className="text-gray-600 dark:text-gray-400 truncate">{app.requester}</dd>
                                </div>
                                <div>
                                    <dt className="font-semibold text-gray-700 dark:text-gray-300">Demanda</dt>
                                    <dd className="text-gray-600 dark:text-gray-400 truncate">{app.demand}</dd>
                                </div>
                                <div>
                                    <dt className="font-semibold text-gray-700 dark:text-gray-300">Tipo</dt>
                                    <dd className="text-gray-600 dark:text-gray-400 truncate">{app.inspectionType}</dd>
                                </div>
                                <div>
                                    <dt className="font-semibold text-gray-700 dark:text-gray-300">Pátio</dt>
                                    <dd className="text-gray-600 dark:text-gray-400 truncate">{app.patio}</dd>
                                </div>
                            </div>
                            <div>
                                <dt className="font-semibold text-gray-700 dark:text-gray-300">Vistoriador</dt>
                                <dd className="text-gray-600 dark:text-gray-400">{getInspectorName(app.inspectorId)}</dd>
                            </div>
                            {app.description && (
                                <div>
                                    <dt className="font-semibold text-gray-700 dark:text-gray-300">Descrição</dt>
                                    <dd className="text-gray-600 dark:text-gray-400 truncate" title={app.description}>{app.description}</dd>
                                </div>
                            )}
                            {app.notes && (
                                <div>
                                    <dt className="font-semibold text-gray-700 dark:text-gray-300">Observação</dt>
                                    <dd className="text-gray-500 italic truncate" title={app.notes}>{app.notes}</dd>
                                </div>
                            )}
                        </dl>
                    </div>

                    {/* Footer with Actions */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3 flex items-center justify-between gap-4 flex-shrink-0">
                        <select
                            value={app.status}
                            onChange={(e) => handleStatusChange(app, e.target.value as AppointmentStatus)}
                            disabled={!canUpdate}
                            className={`flex-grow w-full p-1.5 text-xs font-semibold rounded-md border-0 ring-1 ring-inset ring-transparent focus:ring-2 focus:ring-primary-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 ${getStatusColor(app.status)}`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {settings.statuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <button onClick={() => handleEditClick(app)} disabled={!canUpdate} className="text-primary-500 hover:text-primary-700 disabled:text-gray-400 disabled:cursor-not-allowed"><EditIcon /></button>
                            <button onClick={() => handleDeleteClick(app)} disabled={!canCreateOrDelete} className="text-red-500 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed"><DeleteIcon /></button>
                        </div>
                    </div>
                </div>
            )
        })}
    </div>
  );

  const renderTable = () => (
    <div className="overflow-x-auto hidden md:block">
      <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
        <thead className="text-xs text-white uppercase bg-primary-600">
          <tr>
            <th scope="col" className="px-2 py-3">Id</th>
            <th scope="col" className="px-2 py-3">Data</th>
            <th scope="col" className="px-2 py-3">Placa / Descrição</th>
            <th scope="col" className="px-2 py-3">Solicitante</th>
            <th scope="col" className="px-2 py-3">Tipo de Vistoria</th>
            <th scope="col" className="px-2 py-3">Pátio</th>
            <th scope="col" className="px-2 py-3">Vistoriador</th>
            <th scope="col" className="px-2 py-3">Status</th>
            <th scope="col" className="px-2 py-3">Observações</th>
            <th scope="col" className="px-2 py-3 text-center">Ações</th>
          </tr>
        </thead>
        <tbody>
          {filteredAppointments.map(app => (
            <tr key={app.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-sm">
              <td className="px-2 py-2 whitespace-nowrap text-gray-600 dark:text-gray-400">{app.displayId || `#${app.stringId?.slice(-6).toUpperCase()}`}</td>
              <td className="px-2 py-2 whitespace-nowrap">{new Date(app.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
              <td className="px-2 py-2">
                  <div className="font-medium text-gray-900 dark:text-white whitespace-nowrap">{app.licensePlate}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[180px]" title={app.description}>{app.description}</div>
              </td>
              <td className="px-2 py-2">
                  <div className="font-medium text-gray-900 dark:text-white whitespace-nowrap">{app.requester}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]">{app.demand}</div>
              </td>
              <td className="px-2 py-2">{app.inspectionType}</td>
              <td className="px-2 py-2">{app.patio}</td>
              <td className="px-2 py-2 whitespace-nowrap">{getInspectorName(app.inspectorId)}</td>
              <td className="px-2 py-2 min-w-[120px]">
                <select
                    value={app.status}
                    onChange={(e) => handleStatusChange(app, e.target.value as AppointmentStatus)}
                    disabled={!canUpdate}
                    className={`w-full p-1.5 text-xs font-semibold rounded-md border-0 ring-1 ring-inset ring-transparent focus:ring-2 focus:ring-primary-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 ${getStatusColor(app.status)}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {settings.statuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </td>
              <td className="px-2 py-2 whitespace-nowrap truncate max-w-xs" title={app.notes}>{app.notes}</td>
              <td className="px-2 py-2 flex justify-center items-center gap-1">
                <button onClick={() => handleEditClick(app)} disabled={!canUpdate} className="text-primary-500 hover:text-primary-700 disabled:text-gray-400 disabled:cursor-not-allowed"><EditIcon /></button>
                <button onClick={() => handleDeleteClick(app)} disabled={!canCreateOrDelete} className="text-red-500 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed"><DeleteIcon /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Agendamentos</h1>
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
            <button onClick={() => openFormModal(null)} className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg shadow hover:bg-primary-600 transition-colors font-semibold disabled:bg-primary-300 disabled:cursor-not-allowed">
              <AddIcon />
              Novo Agendamento
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
                        <label htmlFor="searchByDate" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Buscar por Período</label>
                        <input type="date" name="start" value={dateFilter.start} onChange={handleDateFilterChange} disabled={!searchByDate} className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm disabled:opacity-50" />
                        <span className="text-gray-500 text-sm">a</span>
                        <input type="date" name="end" value={dateFilter.end} onChange={handleDateFilterChange} disabled={!searchByDate} className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm disabled:opacity-50" />
                    </div>
                )}
            </div>
        </div>

        {loading ? renderLoading() : (
          <>
            {renderTable()}
            {renderCards()}
            {!loading && filteredAppointments.length === 0 && <p className="text-center py-8 text-gray-500 dark:text-gray-400">Nenhum agendamento encontrado.</p>}
          </>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={selectedAppointment ? 'Editar Agendamento' : 'Novo Agendamento'}>
        <AppointmentForm appointment={selectedAppointment} onSave={handleCloseModal} />
      </Modal>

      <ConfirmationDialog isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} onConfirm={confirmDelete} title="Confirmar Exclusão" message="Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita."/>

      <ConfirmationDialog isOpen={isEditConfirmOpen} onClose={() => setIsEditConfirmOpen(false)} onConfirm={confirmEdit} title="Editar Agendamento" message="Tem certeza que deseja editar este agendamento?" confirmButtonColor="blue" />
    </>
  );
};

export default Appointments;