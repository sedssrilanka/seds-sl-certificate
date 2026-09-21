import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import {
  Upload,
  Search,
  CheckCircle2,
  XCircle,
  Plus,
  X,
  Trash2,
  RefreshCw,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Participant, CsvParticipantRow } from '../../types';
import {
  getParticipants,
  getParticipantCounts,
  toggleParticipantEligibility,
  deleteParticipant,
  addParticipant,
  importParticipantsCSV,
} from '../../lib/supabase';
import { formatDateTime } from '../../lib/crypto';

interface ParticipantsManagerProps {
  eventId: string;
  onDataChanged: () => void;
}

export const ParticipantsManager: React.FC<ParticipantsManagerProps> = ({
  eventId,
  onDataChanged,
}) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'eligible' | 'ineligible' | 'claimed' | 'unclaimed'>(
    'all'
  );
  const [counts, setCounts] = useState<{
    all: number;
    eligible: number;
    ineligible: number;
    claimed: number;
    unclaimed: number;
  }>({
    all: 0,
    eligible: 0,
    ineligible: 0,
    claimed: 0,
    unclaimed: 0,
  });

  // CSV Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    inserted: number;
    updated: number;
    failed: number;
  } | null>(null);
  const [previewRows, setPreviewRows] = useState<CsvParticipantRow[] | null>(null);

  // Add Participant Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRegId, setNewRegId] = useState('');
  const [newEligible, setNewEligible] = useState(true);
  const [newCertPath, setNewCertPath] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [data, countData] = await Promise.all([
        getParticipants(eventId, search, filter),
        getParticipantCounts(eventId),
      ]);
      setParticipants(data);
      setCounts(countData);
    } catch (err) {
      console.error('Error loading participants:', err);
    } finally {
      setLoading(false);
    }
  }, [eventId, search, filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle CSV File Selection
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<CsvParticipantRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          setPreviewRows(results.data);
          setImportResult(null);
          setActionFeedback(null);
          toast.info(`Parsed ${results.data.length} rows from CSV. Ready to import.`);
        } else {
          const msg = 'No valid rows found in CSV.';
          setActionFeedback({ type: 'error', message: msg });
          toast.error(msg);
        }
      },
      error: (error) => {
        console.error('CSV Parse error:', error);
        const msg = 'Failed to parse CSV file. Please verify CSV syntax.';
        setActionFeedback({ type: 'error', message: msg });
        toast.error(msg);
      },
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Confirm CSV Import
  const handleConfirmImport = async () => {
    if (!previewRows || previewRows.length === 0) return;

    setImporting(true);
    try {
      const result = await importParticipantsCSV(eventId, previewRows);
      setImportResult(result);
      setPreviewRows(null);
      loadData();
      onDataChanged();
      toast.success(
        `CSV Import complete: ${result.inserted + result.updated} participants processed.`
      );
    } catch (err) {
      console.error('Import error:', err);
      const msg = 'Failed to import CSV data.';
      setActionFeedback({
        type: 'error',
        message: msg,
      });
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  };

  // Toggle Eligibility
  const handleToggleEligibility = async (participant: Participant) => {
    const nextState = !participant.eligible;
    setParticipants((prev) =>
      prev.map((p) => (p.id === participant.id ? { ...p, eligible: nextState } : p))
    );

    const ok = await toggleParticipantEligibility(participant.id, nextState);
    if (!ok) {
      loadData();
      toast.error('Failed to update participant eligibility.');
    } else {
      toast.success(`Marked "${participant.name}" as ${nextState ? 'Eligible' : 'Ineligible'}`);
    }
    onDataChanged();
  };

  // Delete Participant
  const handleDelete = async (id: string, name: string) => {
    if (window.confirm && !window.confirm(`Remove participant "${name}"?`)) {
      return;
    }
    const ok = await deleteParticipant(id);
    if (ok) {
      toast.success(`Removed participant "${name}"`);
    } else {
      toast.error(`Failed to remove participant "${name}"`);
    }
    loadData();
    onDataChanged();
  };

  // Add Participant Form Submit
  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setModalSubmitting(true);

    try {
      const res = await addParticipant(eventId, {
        name: newName,
        email: newEmail,
        registration_id: newRegId || null,
        eligible: newEligible,
        certificate_path: newCertPath || null,
      });

      if (res.success) {
        toast.success(`Participant "${newName}" added successfully`);
        setShowAddModal(false);
        setNewName('');
        setNewEmail('');
        setNewRegId('');
        setNewEligible(true);
        setNewCertPath('');
        loadData();
        onDataChanged();
      } else {
        const msg = res.message || 'Failed to add participant.';
        setModalError(msg);
        toast.error(msg);
      }
    } catch (err) {
      console.error('Add participant error:', err);
      const msg = 'An unexpected error occurred.';
      setModalError(msg);
      toast.error(msg);
    } finally {
      setModalSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Actions Bar */}
      <div className="bleed-cross space-y-3 bg-[#09090b] p-4">
        <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
              <Search className="h-4 w-4 text-[#3B82F6]" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, or registration ID..."
              className="apple-input w-full py-2 pl-9 pr-3 text-xs placeholder-zinc-500 sm:text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary-sharp inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors"
            >
              <Upload className="h-3.5 w-3.5 text-[#3B82F6]" />
              <span>Import CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="btn-primary-sharp inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-t border-zinc-800 pt-2 text-xs">
          {(['all', 'eligible', 'ineligible', 'claimed', 'unclaimed'] as const).map((key) => {
            const count = counts[key] ?? 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-all ${
                  filter === key
                    ? 'bg-[#3B82F6] text-white shadow-sm'
                    : 'border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                <span>{key}</span>
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-mono leading-none ${
                    filter === key ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={loadData}
            title="Refresh"
            className="ml-auto p-1 text-zinc-400 hover:text-[#3B82F6]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-[#3B82F6]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Alerts */}
      {actionFeedback && (
        <div
          className={`flex items-center justify-between p-3 text-xs font-semibold uppercase tracking-wide ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'border border-rose-600/30 bg-rose-950/30 text-rose-200 shadow-sm'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-white" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="text-white/80 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {importResult && (
        <div className="flex items-center justify-between bg-emerald-600 p-3 text-xs font-semibold uppercase tracking-wide text-white shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-white" />
            <span>
              CSV Imported: {importResult.inserted + importResult.updated} records updated.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setImportResult(null)}
            className="text-white/80 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* CSV Preview Modal */}
      {previewRows && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bleed-cross flex max-h-[80vh] w-full max-w-2xl flex-col space-y-4 bg-[#09090b] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#DFDFDE]">
                Confirm CSV Import ({previewRows.length} participants)
              </h3>
              <button
                type="button"
                onClick={() => setPreviewRows(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto border border-zinc-800 bg-zinc-950/60">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="sticky top-0 bg-zinc-900 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  <tr>
                    <th className="p-2.5">Name</th>
                    <th className="p-2.5">Email</th>
                    <th className="p-2.5">Reg ID</th>
                    <th className="p-2.5">Eligible</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {previewRows.slice(0, 8).map((row, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 font-medium text-white">{row.name}</td>
                      <td className="p-2.5 text-zinc-400">{row.email}</td>
                      <td className="p-2.5 font-mono text-zinc-400">
                        {row.registration_id || '-'}
                      </td>
                      <td className="p-2.5 text-xs">
                        {String(row.eligible).toLowerCase() === 'true' ? 'Yes' : 'No'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPreviewRows(null)}
                className="btn-secondary-sharp px-3 py-1.5 text-xs uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={importing}
                onClick={handleConfirmImport}
                className="btn-primary-sharp px-4 py-1.5 text-xs font-semibold uppercase tracking-wider"
              >
                {importing ? 'Importing...' : 'Confirm Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bleed-cross overflow-hidden border border-zinc-800 bg-[#09090b]">
        <div className="max-h-[580px] overflow-y-auto overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300 sm:text-sm">
            <thead className="sticky top-0 z-10 border-b border-zinc-800 bg-[#121215] text-[11px] font-semibold uppercase tracking-wider text-zinc-400 shadow-sm">
              <tr>
                <th className="bg-[#121215] px-4 py-3">Participant</th>
                <th className="bg-[#121215] px-4 py-3">Registration ID</th>
                <th className="bg-[#121215] px-4 py-3 text-center">Eligibility</th>
                <th className="bg-[#121215] px-4 py-3">Status</th>
                <th className="bg-[#121215] px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-zinc-500">
                    <Loader2 className="mx-auto mb-1.5 h-5 w-5 animate-spin text-[#3B82F6]" />
                    <span className="text-xs uppercase tracking-wider">Loading...</span>
                  </td>
                </tr>
              ) : participants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-zinc-500">
                    No participants found.
                  </td>
                </tr>
              ) : (
                participants.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-900/40">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#DFDFDE]">{p.name}</div>
                      <div className="font-mono text-xs text-zinc-500">{p.email}</div>
                    </td>

                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                      {p.registration_id || '—'}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleEligibility(p)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide shadow-sm transition-all active:scale-95 ${
                          p.eligible
                            ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                        }`}
                      >
                        {p.eligible ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 text-white" />
                            <span>Eligible</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3 text-zinc-400" />
                            <span>Ineligible</span>
                          </>
                        )}
                      </button>
                    </td>

                    <td className="px-4 py-3 text-xs">
                      {p.certificate_claimed ? (
                        <div>
                          <span className="inline-block bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                            Claimed
                          </span>
                          <div className="mt-0.5 font-mono text-[10px] text-zinc-500">
                            {formatDateTime(p.claimed_at)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] uppercase tracking-wider text-zinc-500">
                          Unclaimed
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id, p.name)}
                        className="p-1 text-zinc-500 transition-colors hover:text-rose-400"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bleed-cross w-full max-w-sm space-y-4 bg-[#09090b] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#DFDFDE]">
                Add Participant
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {modalError && (
              <div className="border border-rose-600/30 bg-rose-950/30 p-2.5 text-xs text-rose-300">
                {modalError}
              </div>
            )}

            <form onSubmit={handleAddParticipant} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-300">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="apple-input w-full px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-300">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="apple-input w-full px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-300">
                  Registration ID
                </label>
                <input
                  type="text"
                  value={newRegId}
                  onChange={(e) => setNewRegId(e.target.value)}
                  className="apple-input w-full px-3 py-2 font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-between border border-zinc-800 bg-zinc-950/60 p-3">
                <span className="text-xs uppercase tracking-wider text-zinc-300">
                  Eligible for Certificate
                </span>
                <input
                  type="checkbox"
                  checked={newEligible}
                  onChange={(e) => setNewEligible(e.target.checked)}
                  className="h-4 w-4 border-zinc-700 bg-zinc-900 text-[#3B82F6] accent-[#3B82F6]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary-sharp px-3 py-1.5 text-xs uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="btn-primary-sharp px-4 py-1.5 text-xs font-semibold uppercase tracking-wider"
                >
                  {modalSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
