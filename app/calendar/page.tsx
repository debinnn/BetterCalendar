'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import styles from './calendar.module.css';

interface CalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
}

interface AddEventBody {
  summary: string;
  description: string;
  location: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
  attendees?: { email: string }[];
  recurrence?: string[];
  colorId?: string;
}

export default function Calendar() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'monthly' | 'weekly' | 'daily'>('monthly');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEvents, setModalEvents] = useState<CalendarEvent[]>([]);
  const [modalDay, setModalDay] = useState<Date | null>(null);
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [addEventLoading, setAddEventLoading] = useState(false);
  const [addEventError, setAddEventError] = useState<string | null>(null);
  const [addEventForm, setAddEventForm] = useState({
    summary: '',
    description: '',
    location: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    allDay: false,
    guests: '', // comma separated emails
    recurrence: '',
    color: '',
  });
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [doneEvents, setDoneEvents] = useState<{ [id: string]: boolean }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('doneEvents');
        return stored ? JSON.parse(stored) : {};
      } catch {
        return {};
      }
    }
    return {};
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('doneEvents', JSON.stringify(doneEvents));
    }
  }, [doneEvents]);

  useEffect(() => {
    console.log('Session status:', status);
    console.log('Session data:', session);
    
    if (status === 'unauthenticated') {
      console.log('User is not authenticated, redirecting to home');
      router.push('/');
    }
  }, [status, router, session]);

  // Fetch events logic as a stable callback
  const fetchEvents = useCallback(async () => {
    if (!session) return;
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/calendar/events');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch events');
      }
      const data = await response.json();
      setEvents(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch events');
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  // Only fetch events on initial mount (when session is available), not on every session change
  useEffect(() => {
    if (session && !hasLoadedOnce) {
      fetchEvents().then(() => setHasLoadedOnce(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, hasLoadedOnce]);

  // Helper to reload events (for after event creation)
  const reloadEvents = useCallback(async () => {
    await fetchEvents();
  }, [fetchEvents]);

  if (status === 'loading' || isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <h2>Error Loading Calendar</h2>
        <p>{error}</p>
        <button
          className={styles.retryButton}
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  // Helper to get start of week (Sunday)
  function getStartOfWeek(date: Date) {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // Helper to get days in week
  function getWeekDays(date: Date) {
    const start = getStartOfWeek(date);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }

  // Helper to get events for a specific day
  function getEventsForDay(day: Date) {
    return events.filter((event) => {
      const eventDateStr = event.start.dateTime || event.start.date;
      if (!eventDateStr) return false;
      const eventDate = new Date(eventDateStr);
      return (
        eventDate.getDate() === day.getDate() &&
        eventDate.getMonth() === day.getMonth() &&
        eventDate.getFullYear() === day.getFullYear()
      );
    });
  }

  // Navigation handlers
  function goToPrev() {
    if (viewMode === 'monthly') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else if (viewMode === 'weekly') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 7));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 1));
    }
  }
  function goToNext() {
    if (viewMode === 'monthly') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else if (viewMode === 'weekly') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 7));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1));
    }
  }

  return (
    <div className={styles.calendarContainer}>
      <div className={styles.calendarHeader}>
        <h1 style={{ textAlign: 'center', width: '100%' }}>Calendar</h1>
        <button
          className={styles.addEventButton}
          style={{ position: 'absolute', right: 32, top: 32, zIndex: 2 }}
          onClick={() => setAddEventOpen(true)}
        >
          + Add Event
        </button>
        <div className={styles.viewSwitcher}>
          <button
            className={viewMode === 'daily' ? styles.activeView : ''}
            onClick={() => setViewMode('daily')}
          >
            Daily
          </button>
          <button
            className={viewMode === 'weekly' ? styles.activeView : ''}
            onClick={() => setViewMode('weekly')}
          >
            Weekly
          </button>
          <button
            className={viewMode === 'monthly' ? styles.activeView : ''}
            onClick={() => setViewMode('monthly')}
          >
            Monthly
          </button>
        </div>
        <div className={styles.monthNavigation}>
          <button onClick={goToPrev}>Previous</button>
          <h2>
            {viewMode === 'monthly' && currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            {viewMode === 'weekly' && `Week of ${getStartOfWeek(currentDate).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`}
            {viewMode === 'daily' && currentDate.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}
          </h2>
          <button onClick={goToNext}>Next</button>
        </div>
      </div>

      <div className={styles.calendarGrid}>
        {viewMode === 'monthly' && (
          <>
            <div className={styles.weekDays}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className={styles.weekDay}>
                  {day}
                </div>
              ))}
            </div>
            <div className={styles.daysGrid}>
              {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() }, (_, i) => (
                <div key={`empty-${i}`} className={styles.emptyCell}></div>
              ))}
              {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() }, (_, i) => {
                const day = i + 1;
                const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                const dayEvents = getEventsForDay(dayDate);
                const showCount = 2;
                return (
                  <div
                    key={day}
                    className={styles.dayCell}
                    tabIndex={0}
                    role="button"
                    onClick={() => {
                      setModalEvents(dayEvents);
                      setModalDay(dayDate);
                      setModalOpen(true);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setModalEvents(dayEvents);
                        setModalDay(dayDate);
                        setModalOpen(true);
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className={styles.dayNumber}>{day}</span>
                    <div className={styles.events}>
                      {dayEvents.slice(0, showCount).map((event) => (
                        <div key={event.id} className={styles.event + (doneEvents[event.id] ? ' ' + styles.eventDone : '')}>
                          {event.summary}
                        </div>
                      ))}
                      {dayEvents.length > showCount && (
                        <div
                          className={styles.moreEvents}
                          onClick={e => {
                            e.stopPropagation();
                            setModalEvents(dayEvents);
                            setModalDay(dayDate);
                            setModalOpen(true);
                          }}
                        >
                          +{dayEvents.length - showCount} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {viewMode === 'weekly' && (
          <>
            <div className={styles.weekDays}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className={styles.weekDay}>
                  {day}
                </div>
              ))}
            </div>
            <div className={styles.daysGrid}>
              {getWeekDays(currentDate).map((dayDate, i) => {
                const dayEvents = getEventsForDay(dayDate);
                const showCount = 2;
                return (
                  <div
                    key={i}
                    className={styles.dayCell}
                    tabIndex={0}
                    role="button"
                    onClick={() => {
                      setModalEvents(dayEvents);
                      setModalDay(dayDate);
                      setModalOpen(true);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setModalEvents(dayEvents);
                        setModalDay(dayDate);
                        setModalOpen(true);
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className={styles.dayNumber}>{dayDate.getDate()}</span>
                    <div className={styles.events}>
                      {dayEvents.slice(0, showCount).map((event) => (
                        <div key={event.id} className={styles.event + (doneEvents[event.id] ? ' ' + styles.eventDone : '')}>
                          {event.summary}
                        </div>
                      ))}
                      {dayEvents.length > showCount && (
                        <div
                          className={styles.moreEvents}
                          onClick={e => {
                            e.stopPropagation();
                            setModalEvents(dayEvents);
                            setModalDay(dayDate);
                            setModalOpen(true);
                          }}
                        >
                          +{dayEvents.length - showCount} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {viewMode === 'daily' && (
          <div className={styles.daysGrid} style={{ gridTemplateColumns: '1fr' }}>
            <div className={styles.dayCell} style={{ minHeight: 180, height: 'auto', maxHeight: 'none' }}>
              <span className={styles.dayNumber}>{currentDate.getDate()}</span>
              <div className={styles.events} style={{ maxHeight: 400, overflowY: 'auto' }}>
                {getEventsForDay(currentDate).length === 0 && (
                  <div style={{ color: '#a3a3a3', fontStyle: 'italic', marginTop: '2rem' }}>No events for this day.</div>
                )}
                {getEventsForDay(currentDate).map((event) => (
                  <div key={event.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <label className={styles.doneCheckboxLabel}>
                      <input
                        type="checkbox"
                        checked={!!doneEvents[event.id]}
                        onChange={() => setDoneEvents(prev => ({ ...prev, [event.id]: !prev[event.id] }))}
                        className={styles.doneCheckbox}
                        style={{ accentColor: '#22d3ee', width: 20, height: 20, marginRight: 6 }}
                      />
                    </label>
                    <div className={styles.event + (doneEvents[event.id] ? ' ' + styles.eventDone : '')}>
                      {event.summary}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Modal for all events in a day */}
      {modalOpen && (
        <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1rem', textAlign: 'center' }}>
              Events for {modalDay?.toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' })}
            </h2>
            <div className={styles.modalEventsList}>
              {modalEvents.map((event) => (
                <div key={event.id} className={styles.eventRow}>
                  <label className={styles.doneCheckboxLabel}>
                    <input
                      type="checkbox"
                      checked={!!doneEvents[event.id]}
                      onChange={() => setDoneEvents(prev => ({ ...prev, [event.id]: !prev[event.id] }))}
                      className={styles.doneCheckbox}
                      style={{ accentColor: '#6366f1', width: 16, height: 16, marginRight: 4 }}
                    />
                  </label>
                  <div className={styles.event + (doneEvents[event.id] ? ' ' + styles.eventDone : '')}>
                    {event.summary}
                  </div>
                </div>
              ))}
            </div>
            <button className={styles.retryButton} style={{ marginTop: '2rem', width: '100%' }} onClick={() => setModalOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
      {/* Add Event Modal */}
      {addEventOpen && (
        <div className={styles.modalOverlay} onClick={() => setAddEventOpen(false)}>
          <div className={styles.modal} style={{ overflowY: 'auto', maxHeight: '80vh', minWidth: 340 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1rem', textAlign: 'center' }}>Add New Event</h2>
            <form
              className={styles.addEventForm}
              style={{ maxHeight: '60vh', overflowY: 'auto', width: '100%' }}
              onSubmit={async (e) => {
                e.preventDefault();
                setAddEventLoading(true);
                setAddEventError(null);
                try {
                  const body: AddEventBody = {
                    summary: addEventForm.summary,
                    description: addEventForm.description,
                    location: addEventForm.location,
                    start: addEventForm.allDay
                      ? { date: addEventForm.startDate }
                      : { dateTime: `${addEventForm.startDate}T${addEventForm.startTime}` },
                    end: addEventForm.allDay
                      ? { date: addEventForm.endDate }
                      : { dateTime: `${addEventForm.endDate}T${addEventForm.endTime}` },
                  };
                  if (addEventForm.guests) {
                    body.attendees = addEventForm.guests.split(',').map((email: string) => ({ email: email.trim() }));
                  }
                  if (addEventForm.recurrence) {
                    body.recurrence = [addEventForm.recurrence];
                  }
                  if (addEventForm.color) {
                    body.colorId = addEventForm.color;
                  }
                  const res = await fetch('/api/calendar/events', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                  });
                  if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to add event');
                  }
                  await reloadEvents();
                  setAddEventOpen(false);
                  setAddEventForm({
                    summary: '', description: '', location: '', startDate: '', startTime: '', endDate: '', endTime: '', allDay: false, guests: '', recurrence: '', color: '',
                  });
                } catch (err) {
                  if (err instanceof Error) {
                    setAddEventError(err.message);
                  } else {
                    setAddEventError('An unknown error occurred');
                  }
                } finally {
                  setAddEventLoading(false);
                }
              }}
            >
              <label>
                Title
                <input type="text" required value={addEventForm.summary} onChange={e => setAddEventForm(f => ({ ...f, summary: e.target.value }))} />
              </label>
              <label>
                Description
                <textarea value={addEventForm.description} onChange={e => setAddEventForm(f => ({ ...f, description: e.target.value }))} />
              </label>
              <label>
                Location
                <input type="text" value={addEventForm.location} onChange={e => setAddEventForm(f => ({ ...f, location: e.target.value }))} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={addEventForm.allDay} onChange={e => setAddEventForm(f => ({ ...f, allDay: e.target.checked }))} />
                All Day
              </label>
              <div className={styles.dateTimeRow}>
                <label style={{ flex: 1 }}>
                  Start Date
                  <input type="date" required value={addEventForm.startDate} onChange={e => setAddEventForm(f => ({ ...f, startDate: e.target.value }))} />
                </label>
                {!addEventForm.allDay && (
                  <label style={{ flex: 1 }}>
                    Start Time
                    <input type="time" required value={addEventForm.startTime} onChange={e => setAddEventForm(f => ({ ...f, startTime: e.target.value }))} />
                  </label>
                )}
              </div>
              <div className={styles.dateTimeRow}>
                <label style={{ flex: 1 }}>
                  End Date
                  <input type="date" required value={addEventForm.endDate} onChange={e => setAddEventForm(f => ({ ...f, endDate: e.target.value }))} />
                </label>
                {!addEventForm.allDay && (
                  <label style={{ flex: 1 }}>
                    End Time
                    <input type="time" required value={addEventForm.endTime} onChange={e => setAddEventForm(f => ({ ...f, endTime: e.target.value }))} />
                  </label>
                )}
              </div>
              <label>
                Guests (comma separated emails)
                <input type="text" value={addEventForm.guests} onChange={e => setAddEventForm(f => ({ ...f, guests: e.target.value }))} placeholder="guest1@email.com, guest2@email.com" />
              </label>
              <label>
                Recurrence (RRULE)
                <input type="text" value={addEventForm.recurrence} onChange={e => setAddEventForm(f => ({ ...f, recurrence: e.target.value }))} placeholder="e.g. RRULE:FREQ=WEEKLY;COUNT=10" />
              </label>
              <label>
                Color ID (Google Calendar colorId)
                <input type="text" value={addEventForm.color} onChange={e => setAddEventForm(f => ({ ...f, color: e.target.value }))} placeholder="Optional" />
              </label>
              {addEventError && <div style={{ color: '#ef4444', marginBottom: 8 }}>{addEventError}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                <button type="button" className={styles.retryButton} onClick={() => setAddEventOpen(false)} disabled={addEventLoading}>Cancel</button>
                <button type="submit" className={styles.retryButton} disabled={addEventLoading}>{addEventLoading ? 'Adding...' : 'Add Event'}</button>
              </div>
            </form>
            <button
              className={styles.retryButton}
              style={{ marginTop: 16, width: '100%' }}
              onClick={() => router.push('/')}
            >
              Back to Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 