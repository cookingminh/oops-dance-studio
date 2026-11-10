import { AnimatePresence, motion } from 'framer-motion';
import { Select, SelectItem, Switch } from '@nextui-org/react';
import { LuInfo } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { EASE_OUT } from '../../common/motion';

// "Only for one class?" — off: a shared cost (rent…); on: pick the class, whose margin it lowers.
const ClassField = ({ classes, enabled, onEnabled, classId, onClassId, isInvalid }) => {
    const { t } = useI18n();
    return (
        <div className="exClassField">
            <Switch size="sm" color="danger" isSelected={enabled} onValueChange={onEnabled}>
                {t('Only for one class?')}
            </Switch>
            <AnimatePresence initial={false}>
                {enabled && (
                    <motion.div
                        key="pick"
                        className="exClassPick"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: EASE_OUT }}
                    >
                        <Select
                            label={t('Class')}
                            placeholder={t('Choose the class')}
                            selectedKeys={classId ? [String(classId)] : []}
                            onChange={(event) => onClassId(event.target.value)}
                            isInvalid={isInvalid}
                            errorMessage={isInvalid ? t('Choose the class, or switch this off for a shared cost.') : undefined}
                            classNames={{ popoverContent: 'adminPortal' }}
                        >
                            {classes.map((cls) => (
                                <SelectItem key={String(cls.id)}>{cls.name}</SelectItem>
                            ))}
                        </Select>
                    </motion.div>
                )}
            </AnimatePresence>
            <p className="exHint exClassHint">
                <LuInfo aria-hidden="true" />
                <span>
                    {enabled
                        ? t('It then counts in that class’s margin on the report, e.g. the camera crew or costumes for its shoot.')
                        : t('A shared cost (rent, utilities…) stays at studio level and isn’t split between classes.')}
                </span>
            </p>
        </div>
    );
};

export default ClassField;
