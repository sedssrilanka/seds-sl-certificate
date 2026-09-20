import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronRight, Loader2 } from 'lucide-react';
import { Event } from '../types';
import { getAllPublicEvents } from '../lib/supabase';

export const EventPicker: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const list = await getAllPublicEvents();
        setEvents(list);
      } catch (err) {
        console.error('Error fetching events:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredEvents = events.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12 sm:py-16">
      <div className="mb-8 text-center">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-[#3B82F6]">
          SEDS Sri Lanka
        </div>
        <h1 className="text-2xl font-bold uppercase tracking-tight text-[#DFDFDE] sm:text-3xl">
          Certificate Portal
        </h1>
        <p className="mt-2 text-xs text-zinc-400">
          Select your event to verify and download your official certificate of participation.
        </p>
      </div>

      {/* Search Input */}
      <div className="relative mb-6">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500">
          <Search className="h-4 w-4" />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search event name or code..."
          className="apple-input w-full py-3 pl-10 pr-4 text-sm placeholder-zinc-500"
        />
      </div>

      {/* Events List */}
      <div className="bleed-cross space-y-2 bg-[#09090b] p-3">
        {loading ? (
          <div className="py-12 text-center text-zinc-500">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-[#3B82F6]" />
            <span className="text-xs uppercase tracking-wider">Loading events...</span>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-400">
            No events found matching &ldquo;{search}&rdquo;.
          </div>
        ) : (
          filteredEvents.map((event) => (
            <Link
              key={event.id}
              to={`/${event.slug}`}
              className="group flex items-center justify-between border border-zinc-850 bg-zinc-950/70 p-4 transition-all hover:border-[#3B82F6]/50 hover:bg-zinc-900/60"
            >
              <div>
                <div className="text-sm font-semibold uppercase tracking-wide text-[#DFDFDE] group-hover:text-white">
                  {event.name}
                </div>
                {event.description && (
                  <div className="mt-0.5 text-xs text-zinc-400">{event.description}</div>
                )}
                <div className="mt-1 font-mono text-[11px] text-[#3B82F6]">/{event.slug}</div>
              </div>
              <ChevronRight className="ml-4 h-4 w-4 shrink-0 text-zinc-500 transition-transform group-hover:translate-x-1 group-hover:text-[#3B82F6]" />
            </Link>
          ))
        )}
      </div>
    </div>
  );
};
