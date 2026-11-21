import ApproveJoinDialog from './ApproveJoinDialog';
import DeclineJoinDialog from './DeclineJoinDialog';

// The open approve / decline dialog, shared by the Join requests page and the class hub's block.
//   dialog  { kind: 'approve' | 'decline', request } or null
//   onDone(kind, row) after the request was answered
const JoinDialogs = ({ dialog, onClose, onDone }) => {
    if (!dialog) return null;
    const Dialog = dialog.kind === 'approve' ? ApproveJoinDialog : DeclineJoinDialog;
    return <Dialog key={dialog.request.id} request={dialog.request} onClose={onClose} onDone={(row) => onDone(dialog.kind, row)} />;
};

export default JoinDialogs;
