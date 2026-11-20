import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Reorder, useDragControls } from 'framer-motion';
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Switch } from '@nextui-org/react';
import { LuGalleryHorizontal, LuGripVertical, LuImagePlus, LuMonitor, LuPencil, LuPlus, LuSmartphone, LuTrash2, LuVideo } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { ErrorMessage, Loading } from '@/ui/feedback/AsyncState';
import { BANNER_MAX_LIVE, BANNER_SPECS, deleteBanner, listBanners, posterUrl, reorderBanners, setBannerEnabled } from '@/services/banners';
import SectionCard from '../../common/SectionCard';
import { bannerStates } from './bannerModel';

// /admin/banners: every homepage banner in its order (drag the handle to reorder), whether it shows today,
// a switch to show / hide it, edit and delete. The studio's own slide (the video) always comes first.
const BannerList = () => {
    const i18n = useI18n();
    const { t, formatDate } = i18n;
    const toast = useToast();
    const navigate = useNavigate();
    const list = useAsync(listBanners, []);
    const [order, setOrder] = useState([]);
    const [busy, setBusy] = useState(null); // banner id being switched
    const [deleting, setDeleting] = useState(null); // the banner asked about
    const [removing, setRemoving] = useState(false);

    useEffect(() => {
        if (list.data) setOrder(list.data);
    }, [list.data]);

    const states = bannerStates(order);
    const dateOf = (iso) => formatDate(iso, 'short');
    const datesOf = (banner) =>
        banner.starts_on && banner.ends_on
            ? t('{from} → {to}', { from: dateOf(banner.starts_on), to: dateOf(banner.ends_on) })
            : banner.starts_on
              ? t('From {date}', { date: dateOf(banner.starts_on) })
              : banner.ends_on
                ? t('Until {date}', { date: dateOf(banner.ends_on) })
                : t('No end date');

    const saveOrder = async () => {
        const ids = order.map((banner) => banner.id);
        if (ids.join() === (list.data ?? []).map((banner) => banner.id).join()) return;
        try {
            await reorderBanners(ids);
            toast.success('New order saved');
            list.reload();
        } catch (error) {
            toast.error(error);
            setOrder(list.data ?? []);
        }
    };

    const toggle = async (banner, enabled) => {
        setBusy(banner.id);
        setOrder((rows) => rows.map((row) => (row.id === banner.id ? { ...row, enabled } : row)));
        try {
            await setBannerEnabled(banner.id, enabled);
            list.reload();
        } catch (error) {
            toast.error(error);
            setOrder(list.data ?? []);
        } finally {
            setBusy(null);
        }
    };

    const remove = async () => {
        setRemoving(true);
        try {
            await deleteBanner(deleting.id);
            toast.success('Banner deleted');
            setDeleting(null);
            list.reload();
        } catch (error) {
            toast.error(error);
        } finally {
            setRemoving(false);
        }
    };

    const newButton = (
        <Button color="danger" startContent={<LuPlus aria-hidden="true" />} onPress={() => navigate('/admin/banners/new')}>
            {t('New banner')}
        </Button>
    );

    return (
        <SectionCard
            className="bnList"
            icon={LuGalleryHorizontal}
            title={t('Homepage banners')}
            subtitle={t('The homepage slides through them, after the studio’s own slide. Up to {count} show at a time, in this order.', { count: BANNER_MAX_LIVE })}
            actions={order.length > 0 ? newButton : null}
        >
            {list.error && !list.data && <ErrorMessage error={list.error} onRetry={list.reload} />}
            {list.loading && !list.data && <Loading />}
            {list.data && order.length === 0 && (
                <div className="bnEmpty">
                    <span className="bnEmptyIcon" aria-hidden="true">
                        <LuImagePlus />
                    </span>
                    <strong>{t('No banners yet')}</strong>
                    <p>{t('Design a poster in two sizes, upload both, then place its buttons on a live preview.')}</p>
                    <ul className="bnSpecs">
                        <li>
                            <LuMonitor aria-hidden="true" /> {t('Desktop')} · {BANNER_SPECS.desktop.width} × {BANNER_SPECS.desktop.height} px
                            <small>{t('Canva: “Presentation (16:9)”')}</small>
                        </li>
                        <li>
                            <LuSmartphone aria-hidden="true" /> {t('Phone')} · {BANNER_SPECS.phone.width} × {BANNER_SPECS.phone.height} px
                            <small>{t('Canva: “Instagram Story”')}</small>
                        </li>
                    </ul>
                    {newButton}
                </div>
            )}
            {order.length > 0 && (
                <>
                    <div className="bnRow bnRowStudio">
                        <span className="bnHandle isFixed" aria-hidden="true" />
                        <span className="bnThumb isStudio" aria-hidden="true">
                            <LuVideo />
                        </span>
                        <span className="bnRowText">
                            <strong>{t('Studio slide (the video)')}</strong>
                            <small>{t('Always first, can’t be moved')}</small>
                        </span>
                        <span className="bnRowEnd">
                            <span className="bnState is-live">{t('Showing')}</span>
                        </span>
                    </div>
                    <Reorder.Group axis="y" values={order} onReorder={setOrder} className="bnRows" as="ol">
                        {order.map((banner) => (
                            <BannerRow
                                key={banner.id}
                                banner={banner}
                                state={states[banner.id]}
                                dates={datesOf(banner)}
                                busy={busy === banner.id}
                                onToggle={toggle}
                                onDelete={() => setDeleting(banner)}
                                onDrop={saveOrder}
                            />
                        ))}
                    </Reorder.Group>
                    <p className="bnHint">{t('Drag the handle to change the order. The new order saves when you let go.')}</p>
                </>
            )}

            {deleting && (
                <Modal isOpen onOpenChange={(open) => !open && !removing && setDeleting(null)} placement="center" classNames={{ base: 'adminPortal bnDialog' }}>
                    <ModalContent>
                        <ModalHeader>{t('Delete “{name}”?', { name: deleting.name })}</ModalHeader>
                        <ModalBody>
                            <p>{t('It leaves the homepage at once, and both posters are deleted. This can’t be undone.')}</p>
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="flat" onPress={() => setDeleting(null)} isDisabled={removing}>
                                {t('Keep it')}
                            </Button>
                            <Button color="danger" onPress={remove} isLoading={removing}>
                                {t('Delete banner')}
                            </Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>
            )}
        </SectionCard>
    );
};

const BannerRow = ({ banner, state, dates, busy, onToggle, onDelete, onDrop }) => {
    const { t, tn, formatDate } = useI18n();
    const controls = useDragControls();
    const stateText = state ? t(state.key, state.vars ? { date: formatDate(state.vars.date, 'short') } : undefined) : '';

    return (
        <Reorder.Item value={banner} dragListener={false} dragControls={controls} onDragEnd={onDrop} className={`bnRow is-${state?.tone ?? 'off'}`} data-banner={banner.id}>
            <button
                type="button"
                className="bnHandle"
                onPointerDown={(event) => controls.start(event)}
                aria-label={t('Drag to move {name}', { name: banner.name })}
                title={t('Drag to change the order')}
            >
                <LuGripVertical aria-hidden="true" />
            </button>
            <span className="bnThumb">
                <img src={posterUrl(banner.desktop_path)} alt="" draggable={false} />
            </span>
            <span className="bnRowText">
                <strong>{banner.name}</strong>
                <small>
                    {dates} · {tn(banner.buttons?.length ?? 0, '{count} button', '{count} buttons')}
                </small>
            </span>
            <span className="bnRowEnd">
                <span className={`bnState is-${state?.tone ?? 'off'}`}>{stateText}</span>
                <Switch
                    size="sm"
                    color="success"
                    isSelected={banner.enabled}
                    isDisabled={busy}
                    onValueChange={(on) => onToggle(banner, on)}
                    aria-label={t('Show {name} on the homepage', { name: banner.name })}
                />
                <span className="bnRowActions">
                    <Button as={Link} to={`/admin/banners/${banner.id}`} size="sm" variant="flat" startContent={<LuPencil aria-hidden="true" />}>
                        {t('Edit')}
                    </Button>
                    <Button isIconOnly size="sm" variant="light" color="danger" onPress={onDelete} aria-label={t('Delete {name}', { name: banner.name })}>
                        <LuTrash2 aria-hidden="true" />
                    </Button>
                </span>
            </span>
        </Reorder.Item>
    );
};

export default BannerList;
