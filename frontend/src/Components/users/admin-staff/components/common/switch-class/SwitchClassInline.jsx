import { LuArrowRightLeft } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import SwitchClassForm from './SwitchClassForm';
import './switchClass.scss';

// The same switch, opened inside a panel that is already a dialog (the person panel on
// /admin/users): no dialog on top of a dialog, it unfolds in place instead.
const SwitchClassInline = ({ student, fromClass, onCancel, onSwitched }) => {
    const { t } = useI18n();
    return (
        <div className="swInline" role="group" aria-labelledby="sw-inline-title">
            <p id="sw-inline-title" className="swInlineTitle">
                <LuArrowRightLeft aria-hidden="true" />
                {t('Switch {name} from {className}', { name: student.name, className: fromClass.name })}
            </p>
            <SwitchClassForm student={student} fromClass={fromClass} onCancel={onCancel} onSwitched={onSwitched} />
        </div>
    );
};

export default SwitchClassInline;
