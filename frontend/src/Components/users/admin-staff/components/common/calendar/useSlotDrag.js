import { useEffect, useRef, useState } from 'react';
import { SLOT_MINUTES, timeOf } from './calendarModel';

// Minute of the half-hour slot under `clientY` in a day / lane track, clamped to the grid.
function slotAt(element, clientY, range) {
    const rect = element.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientY - rect.top) / rect.height, 0), 0.9999);
    return range.start + Math.floor((ratio * (range.end - range.start)) / SLOT_MINUTES) * SLOT_MINUTES;
}

function release(live) {
    if (live?.element.hasPointerCapture?.(live.pointerId)) live.element.releasePointerCapture(live.pointerId);
}

// Press and drag over free slots (mouse / pen) to pick a time range in one day, and one lane when the
// grid has lanes; a press without moving picks one slot. Esc cancels. Touch keeps the plain tap, so
// the grid still scrolls under a finger. onPick(date, 'HH:mm', { lane, end? }): `end` only for a
// range longer than one slot (the page picks a default length otherwise).
export function useSlotDrag({ range, onPick }) {
    const [drag, setDrag] = useState(null); // { date, lane, from, to } in minutes, `to` exclusive
    const live = useRef(null); // { element, pointerId, date, lane, anchor, current }
    const pointerType = useRef(null);

    const publish = (state) =>
        setDrag({
            date: state.date,
            lane: state.lane,
            from: Math.min(state.anchor, state.current),
            to: Math.max(state.anchor, state.current) + SLOT_MINUTES,
        });

    const active = Boolean(drag);
    useEffect(() => {
        if (!active) return undefined;
        const onKey = (event) => {
            if (event.key !== 'Escape') return;
            release(live.current);
            live.current = null;
            setDrag(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [active]);

    if (!onPick) return { drag: null, handlersFor: () => ({}) };

    const handlersFor = (date, lane) => ({
        onPointerDown: (event) => {
            pointerType.current = event.pointerType;
            if (event.pointerType === 'touch' || event.button !== 0 || event.target.closest('.calItem')) return;
            event.preventDefault(); // no text selection, no focus jump
            const element = event.currentTarget;
            element.setPointerCapture?.(event.pointerId);
            const minute = slotAt(element, event.clientY, range);
            live.current = { element, pointerId: event.pointerId, date, lane, anchor: minute, current: minute };
            publish(live.current);
        },
        onPointerMove: (event) => {
            const state = live.current;
            if (!state || event.pointerId !== state.pointerId) return;
            const minute = slotAt(state.element, event.clientY, range);
            if (minute === state.current) return;
            state.current = minute;
            publish(state);
        },
        onPointerUp: (event) => {
            const state = live.current;
            if (!state || event.pointerId !== state.pointerId) return;
            release(state);
            live.current = null;
            setDrag(null);
            const from = Math.min(state.anchor, state.current);
            const to = Math.max(state.anchor, state.current) + SLOT_MINUTES;
            onPick(state.date, timeOf(from), { lane: state.lane, ...(to - from > SLOT_MINUTES ? { end: timeOf(to) } : {}) });
        },
        onPointerCancel: () => {
            release(live.current);
            live.current = null;
            setDrag(null);
        },
        // Touch: a tap on a free slot.
        onClick: (event) => {
            if (pointerType.current !== 'touch') return;
            const slot = event.target.closest('.calSlot');
            if (slot) onPick(date, slot.dataset.time, { lane });
        },
    });

    return { drag, handlersFor };
}
