import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getActiveLoans } from '../../services/loanService';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

export default function DueDatesCalendar() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getActiveLoans()
      .then((data) => {
        if (!cancelled) setLoans(data ?? []);
      })
      .catch(() => {
        if (!cancelled) setLoans([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const days = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [monthCursor]);

  const loansByDay = useMemo(() => {
    const map = new Map();
    for (const loan of loans) {
      if (!loan.due_date) continue;
      const due = new Date(loan.due_date);
      if (due.getMonth() !== monthCursor.getMonth() || due.getFullYear() !== monthCursor.getFullYear()) {
        continue;
      }
      const key = due.getDate();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(loan);
    }
    return map;
  }, [loans, monthCursor]);

  const today = new Date();
  const selectedLoans = selectedDay ? loansByDay.get(selectedDay.getDate()) ?? [] : [];

  return (
    <div className="flex h-full flex-col rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Due Dates</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
              setSelectedDay(null);
            }}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[8rem] text-center text-sm font-medium text-slate-600 dark:text-slate-300">
            {monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </span>
          <button
            type="button"
            onClick={() => {
              setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
              setSelectedDay(null);
            }}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex-1 animate-pulse rounded bg-slate-100 dark:bg-slate-700" />
      ) : (
        <div className="flex flex-1 flex-col">
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-medium text-slate-400">
            {WEEKDAYS.map((d, i) => (
              <div key={i}>{d}</div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1.5">
            {days.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} />;
              const dueCount = loansByDay.get(day.getDate())?.length ?? 0;
              const isToday = sameDay(day, today);
              const isSelected = selectedDay && sameDay(day, selectedDay);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelectedDay(dueCount > 0 ? day : null)}
                  className={`relative flex h-10 flex-col items-center justify-center rounded-md text-sm transition-colors ${
                    isSelected
                      ? 'bg-primary-600 text-white'
                      : isToday
                        ? 'font-semibold text-primary-600 ring-1 ring-primary-300 dark:text-primary-300'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {day.getDate()}
                  {dueCount > 0 && (
                    <span
                      className={`absolute bottom-1 h-1 w-1 rounded-full ${
                        isSelected ? 'bg-white' : 'bg-red-500'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex-1 space-y-1.5 border-t border-slate-100 pt-4 dark:border-slate-700">
            {selectedDay ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Due {selectedDay.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </p>
                {selectedLoans.map((loan) => (
                  <p key={loan.id} className="truncate text-sm text-slate-700 dark:text-slate-200">
                    {loan.books?.title ?? 'Book'} — {loan.members?.full_name ?? 'Member'}
                  </p>
                ))}
              </>
            ) : (
              <p className="text-sm text-slate-400">Click a highlighted day to see what&apos;s due.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
