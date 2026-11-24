import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { JoinContext } from './joinContext';
import { useJoinState } from './useJoinState';
import JoinDialog from './JoinDialog';
import RequestDialog from './RequestDialog';

const scrollToCard = (id) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(`class-${id}`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
};

// One per public page (/classes, /home): the viewer's join state for every class card (JoinButton) and the promo
// dialog, and the two dialogs (asking to join; a request that is waiting). `classes` is list_public_classes() data.
// Back from logging in at /classes?join=<id>, it opens that class's dialog (or shows its card) and drops the param.
const JoinProvider = ({ classes, children }) => {
    const join = useJoinState();
    const [asking, setAsking] = useState(null); // a class row
    const [viewing, setViewing] = useState(null); // { item, request }
    const [params, setParams] = useSearchParams();
    const wanted = Number(params.get('join')) || null;
    const { stateOf, seatsOf, pendingOf, viewer } = join;

    useEffect(() => {
        if (!wanted || !classes) return;
        const state = stateOf(wanted);
        if (state === null && viewer !== 'other') return; // not known yet
        const item = classes.find((cls) => cls.id === wanted);
        if (item && state === 'ask') setAsking(item);
        else if (item && state === 'pending') setViewing({ item, request: pendingOf(wanted) });
        else if (item) setTimeout(() => scrollToCard(wanted), 300);
        setParams(
            (current) => {
                const next = new URLSearchParams(current);
                next.delete('join');
                return next;
            },
            { replace: true }
        );
    }, [wanted, classes, stateOf, pendingOf, viewer, setParams]);

    const value = useMemo(
        () => ({
            viewer,
            stateOf,
            seatsOf,
            open: (item) => setAsking(item),
            show: (item) => {
                const request = pendingOf(item.id);
                if (request) setViewing({ item, request });
            },
        }),
        [viewer, stateOf, seatsOf, pendingOf]
    );

    return (
        <JoinContext.Provider value={value}>
            {children}
            {asking && <JoinDialog item={asking} pendingCount={join.pendingCount} onClose={() => setAsking(null)} onSent={join.refresh} />}
            {viewing && <RequestDialog item={viewing.item} request={viewing.request} onClose={() => setViewing(null)} onCancelled={join.refresh} />}
        </JoinContext.Provider>
    );
};

export default JoinProvider;
