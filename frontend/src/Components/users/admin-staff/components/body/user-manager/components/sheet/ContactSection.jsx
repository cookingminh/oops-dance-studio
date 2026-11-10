import { Button, Tooltip } from '@nextui-org/react';
import { LuAtSign, LuCake, LuCopy, LuMail, LuPhone } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { ageOn } from '../../peopleModel';

// How to reach the person: email and phone with one-tap links, plus username and birthday.
const ContactSection = ({ person, today, onEdit }) => {
    const { t, tn, intl } = useI18n();
    const toast = useToast();
    const age = ageOn(person.date_of_birth, today);
    // "15 March 2002": a birthday needs no weekday.
    const birthday = person.date_of_birth
        ? new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${person.date_of_birth}T00:00:00`))
        : '';
    const phoneHref = `tel:${(person.contact_number ?? '').replace(/[^\d+]/g, '')}`;

    const copyEmail = async () => {
        try {
            await navigator.clipboard.writeText(person.email);
            toast.success('Email copied.');
        } catch {
            toast.error('Couldn’t copy. Select the text and copy it yourself.');
        }
    };

    const addButton = (field) => (
        <Button size="sm" variant="light" className="factAdd" onPress={() => onEdit(field)}>
            {t('Add')}
        </Button>
    );

    return (
        <section className="sheetSection" aria-labelledby="sheet-contact">
            <h3 id="sheet-contact">{t('Contact')}</h3>
            <ul className="factList">
                <li>
                    <span className="factIcon" aria-hidden="true">
                        <LuMail />
                    </span>
                    <span className="factText">
                        <small>{t('Email')}</small>
                        <strong className="isBreakable">{person.email}</strong>
                    </span>
                    <span className="factActions">
                        <Tooltip content={t('Copy email')}>
                            <Button isIconOnly size="sm" variant="light" aria-label={t('Copy email')} onPress={copyEmail}>
                                <LuCopy />
                            </Button>
                        </Tooltip>
                        <a className="factLink" href={`mailto:${person.email}`}>
                            {t('Write')}
                        </a>
                    </span>
                </li>
                <li>
                    <span className="factIcon" aria-hidden="true">
                        <LuPhone />
                    </span>
                    <span className="factText">
                        <small>{t('Phone')}</small>
                        {person.contact_number ? <strong>{person.contact_number}</strong> : <em className="isMissing">{t('No phone number')}</em>}
                    </span>
                    <span className="factActions">
                        {person.contact_number ? (
                            <a className="factLink" href={phoneHref}>
                                {t('Call')}
                            </a>
                        ) : (
                            addButton('phone')
                        )}
                    </span>
                </li>
                <li>
                    <span className="factIcon" aria-hidden="true">
                        <LuAtSign />
                    </span>
                    <span className="factText">
                        <small>{t('Username')}</small>
                        {person.username ? <strong>@{person.username}</strong> : <em>{t('No username')}</em>}
                    </span>
                </li>
                <li>
                    <span className="factIcon" aria-hidden="true">
                        <LuCake />
                    </span>
                    <span className="factText">
                        <small>{t('Date of birth')}</small>
                        {person.date_of_birth ? (
                            <strong>
                                {birthday}
                                {age !== null && age >= 0 && <span className="factSoft"> · {tn(age, '{count} year old', '{count} years old')}</span>}
                            </strong>
                        ) : (
                            <em>{t('Not added')}</em>
                        )}
                    </span>
                    {!person.date_of_birth && <span className="factActions">{addButton('birthday')}</span>}
                </li>
            </ul>
        </section>
    );
};

export default ContactSection;
