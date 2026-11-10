import BookingPayDialog from '@/ui/payment/BookingPayDialog';
import PayDialog from '../components/body/pages/tuition/PayDialog';

// The QR pay dialog for one item of loadMyDues(): tuition or a room booking. onClose() after it shuts
// (paid or not): the caller refreshes what is owed.
const DuePay = ({ item, settings, sandbox, onClose }) =>
    item.invoice ? (
        <PayDialog invoice={item.invoice} settings={settings} sandbox={sandbox} onClose={onClose} />
    ) : (
        <BookingPayDialog booking={item.booking} settings={settings} sandbox={Boolean(sandbox)} onClose={onClose} onChanged={() => {}} />
    );

export default DuePay;
