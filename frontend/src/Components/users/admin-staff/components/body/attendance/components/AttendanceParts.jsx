import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Tooltip } from '@nextui-org/react';
import { LuStickyNote } from 'react-icons/lu';
import { VerticalDotsIcon } from '../../../../../../Table/VerticalDotsIcon';

// Small pieces shared by the attendance sections. `actions` comes from Attendance.jsx.

export const ProofThumb = ({ url, label, onView }) =>
    url ? (
        <button type="button" className="proofThumb" aria-label="View proof photo" title={label} onClick={() => onView(url, label)}>
            <img src={url} alt="" />
        </button>
    ) : null;

export const NoteButton = ({ record }) =>
    record.details ? (
        <Tooltip content={<span className="noteTooltip">{record.details}</span>}>
            <Button isIconOnly size="sm" variant="light" aria-label="Session note">
                <LuStickyNote className="text-default-500" />
            </Button>
        </Tooltip>
    ) : null;

export const AttendanceMenu = ({ record, actions }) => {
    const items = [];
    if (record.status !== 'completed') {
        items.push(<DropdownItem key="approve" onPress={() => actions.approve(record)}>Mark completed</DropdownItem>);
    }
    items.push(<DropdownItem key="details" onPress={() => actions.details(record)}>{record.details ? 'Edit note' : 'Add note'}</DropdownItem>);
    if (record.status === 'pending' || record.status === 'waiting') {
        items.push(<DropdownItem key="instructor" onPress={() => actions.instructor(record)}>Change instructor</DropdownItem>);
    }
    if (record.status !== 'cancelled') {
        items.push(
            <DropdownItem key="cancel" className="text-danger" color="danger" onPress={() => actions.cancel(record)}>
                Cancel session
            </DropdownItem>
        );
    }
    return (
        <Dropdown>
            <DropdownTrigger>
                <Button isIconOnly size="sm" variant="light" aria-label="Attendance actions">
                    <VerticalDotsIcon className="text-default-400" />
                </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Attendance actions">{items}</DropdownMenu>
        </Dropdown>
    );
};
