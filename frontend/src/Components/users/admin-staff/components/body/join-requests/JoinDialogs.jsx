import ApproveJoinDialog from './ApproveJoinDialog';
import DeclineJoinDialog from './DeclineJoinDialog';
import DeclineRestDialog from './DeclineRestDialog';

// The open approve / decline dialog, shared by the Join requests page and the class hub's block.
//   dialog  { kind: 'approve' | 'decline', request }, { kind: 'declineRest', className, requests } (a full class:
//           every request still waiting at once) or null
//   onDone(kind, row) after the request(s) were answered
const JoinDialogs = ({ dialog, onClose, onDone }) => {
    if (!dialog) return null;
    if (dialog.kind === 'declineRest') {
        return <DeclineRestDialog className={dialog.className} requests={dialog.requests} onClose={onClose} onDone={() => onDone(dialog.kind, null)} />;
    }
    const Dialog = dialog.kind === 'approve' ? ApproveJoinDialog : DeclineJoinDialog;
    return <Dialog key={dialog.request.id} request={dialog.request} onClose={onClose} onDone={(row) => onDone(dialog.kind, row)} />;
};

export default JoinDialogs;
