import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Table,
    TableHeader,
    TableColumn,
    TableBody,
    TableRow,
    TableCell,
    Input,
    Button,
    DropdownTrigger,
    Dropdown,
    DropdownMenu,
    DropdownItem,
    Chip,
    User,
    Pagination,
    Avatar,
    Modal,
    ModalBody,
    ModalContent,
    ModalHeader,
    Image,
} from '@nextui-org/react';
import { PlusIcon } from './PlusIcon';
import { SearchIcon } from './SearchIcon';
import { ChevronDownIcon } from './ChevronDownIcon';
import { capitalize, statusColorMap } from './utils';
import { AVATAR_DEFAULTS } from '@/ui/avatar';

const SEARCH_FIELDS = ['username', 'name', 'email', 'instructor_name', 'guest_username', 'day_label', 'date', 'class_name', 'room'];

// Image fields (avatar, class_img, …) hold ready-to-use URLs.
const TableTemplate = ({
    columns,
    data,
    statusOptions = [],
    initialVisibleColumns,
    rowsPerPageOptions = [5, 10, 15],
    renderActions,
    onAddNew,
    AddNewBtn_active,
    StatusBtn_active,
    ariaLabel = 'Data table',
}) => {
    const [modalImage, setModalImage] = useState(null);
    const [filterValue, setFilterValue] = useState('');
    const [visibleColumns, setVisibleColumns] = useState(new Set(initialVisibleColumns));
    const [statusFilter, setStatusFilter] = useState('all');
    const [rowsPerPage, setRowsPerPage] = useState(rowsPerPageOptions[0]);
    const [page, setPage] = useState(1);
    const [sortDescriptor, setSortDescriptor] = useState(() => {
        if (columns.some((col) => col.uid === 'no')) return { column: 'no', direction: 'ascending' };
        if (columns.some((col) => col.uid === 'date')) return { column: 'date', direction: 'descending' };
        return { column: 'id', direction: 'ascending' };
    });

    const headerColumns = useMemo(() => {
        if (visibleColumns === 'all') return columns;
        return columns.filter((column) => visibleColumns.has(column.uid));
    }, [visibleColumns, columns]);

    const filteredItems = useMemo(() => {
        let rows = data;
        const term = filterValue.trim().toLowerCase();
        if (term) {
            rows = rows.filter((item) =>
                SEARCH_FIELDS.some((field) => String(item[field] ?? '').toLowerCase().includes(term))
            );
        }
        if (statusFilter !== 'all' && statusFilter.size !== statusOptions.length) {
            rows = rows.filter((item) => statusFilter.has(item.status) || statusFilter.has(item.deposit_status));
        }
        return rows;
    }, [data, filterValue, statusFilter, statusOptions.length]);

    // Sort the whole filtered list, then paginate.
    const sortedItems = useMemo(() => {
        const { column, direction } = sortDescriptor;
        return [...filteredItems].sort((a, b) => {
            const first = a[column];
            const second = b[column];
            const cmp = first < second ? -1 : first > second ? 1 : 0;
            return direction === 'descending' ? -cmp : cmp;
        });
    }, [filteredItems, sortDescriptor]);

    const pages = Math.max(1, Math.ceil(sortedItems.length / rowsPerPage));

    useEffect(() => {
        if (page > pages) setPage(pages);
    }, [page, pages]);

    const items = useMemo(() => {
        const start = (page - 1) * rowsPerPage;
        return sortedItems.slice(start, start + rowsPerPage);
    }, [page, sortedItems, rowsPerPage]);

    const renderCell = useCallback((item, columnKey) => {
        const cellValue = item[columnKey];

        switch (columnKey) {
            case 'class':
                return <User avatarProps={{ ...AVATAR_DEFAULTS, radius: 'lg', src: item.class_img ?? undefined, name: item.class_name }} name={item.class_name} />;
            case 'status':
                return (
                    <Chip className="capitalize" color={statusColorMap[cellValue] ?? 'default'} size="sm" variant="flat">
                        {String(cellValue ?? '').replace('_', ' ')}
                    </Chip>
                );
            case 'deposit_status':
                return (
                    <Chip className="capitalize" color={statusColorMap[cellValue] ?? 'default'} size="sm" variant="dot">
                        {cellValue}
                    </Chip>
                );
            case 'user':
            case 'username':
                return (
                    <User
                        avatarProps={{ ...AVATAR_DEFAULTS, radius: 'lg', src: item.user_avatar ?? item.avatar ?? undefined, name: item.name || item.username }}
                        description={item.user_email || item.email}
                        name={columnKey === 'username' ? item.username : item.name || item.username}
                    />
                );
            case 'guest':
                return (
                    <User
                        avatarProps={{ ...AVATAR_DEFAULTS, radius: 'lg', src: item.guest_avatar ?? undefined, name: item.guest_username }}
                        description={item.guest_email}
                        name={item.guest_username}
                    />
                );
            case 'instructor':
                return (
                    <User
                        avatarProps={{ ...AVATAR_DEFAULTS, radius: 'lg', src: item.instructor_avatar ?? undefined, name: item.instructor_name }}
                        description={item.instructor_email}
                        name={item.instructor_name}
                    />
                );
            case 'class_lesson':
                return <User avatarProps={{ ...AVATAR_DEFAULTS, radius: 'lg', src: item.class_img ?? undefined, name: item.class_name }} name={item.class_lesson} />;
            case 'checkin_proof':
            case 'checkout_proof':
                return (
                    <div className="flex justify-center">
                        {cellValue ? (
                            <Avatar {...AVATAR_DEFAULTS}
                                as="button"
                                src={cellValue}
                                radius="sm"
                                aria-label="View proof photo"
                                onClick={() => setModalImage(cellValue)}
                            />
                        ) : (
                            <span className="text-default-400">No proof</span>
                        )}
                    </div>
                );
            case 'actions':
                return renderActions ? renderActions(item) : cellValue;
            default:
                return cellValue ?? '';
        }
    }, [renderActions]);

    const onRowsPerPageChange = useCallback((event) => {
        setRowsPerPage(Number(event.target.value));
        setPage(1);
    }, []);

    const onSearchChange = useCallback((value) => {
        setFilterValue(value ?? '');
        setPage(1);
    }, []);

    const topContent = (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between gap-3 items-end">
                <Input
                    isClearable
                    aria-label="Search"
                    className="w-full sm:max-w-[44%]"
                    placeholder="Search..."
                    startContent={<SearchIcon />}
                    value={filterValue}
                    onClear={() => onSearchChange('')}
                    onValueChange={onSearchChange}
                />
                <div className="flex gap-2">
                    {statusOptions.length > 0 && (
                        <div className={StatusBtn_active}>
                            <Dropdown>
                                <DropdownTrigger className="hidden sm:flex">
                                    <Button endContent={<ChevronDownIcon className="text-small" />} variant="flat">
                                        Status
                                    </Button>
                                </DropdownTrigger>
                                <DropdownMenu
                                    disallowEmptySelection
                                    aria-label="Filter by status"
                                    closeOnSelect={false}
                                    selectedKeys={statusFilter}
                                    selectionMode="multiple"
                                    onSelectionChange={(keys) => {
                                        setStatusFilter(keys);
                                        setPage(1);
                                    }}
                                >
                                    {statusOptions.map((status) => (
                                        <DropdownItem key={status.uid} className="capitalize">
                                            {capitalize(status.name)}
                                        </DropdownItem>
                                    ))}
                                </DropdownMenu>
                            </Dropdown>
                        </div>
                    )}
                    <Dropdown>
                        <DropdownTrigger className="sm:flex">
                            <Button endContent={<ChevronDownIcon className="text-small" />} variant="flat">
                                Columns
                            </Button>
                        </DropdownTrigger>
                        <DropdownMenu
                            disallowEmptySelection
                            aria-label="Visible columns"
                            closeOnSelect={false}
                            selectedKeys={visibleColumns}
                            selectionMode="multiple"
                            onSelectionChange={setVisibleColumns}
                        >
                            {columns.map((column) => (
                                <DropdownItem key={column.uid} className="capitalize">
                                    {capitalize(column.name)}
                                </DropdownItem>
                            ))}
                        </DropdownMenu>
                    </Dropdown>
                    {onAddNew && (
                        <Button color="danger" endContent={<PlusIcon />} onPress={onAddNew} className={AddNewBtn_active}>
                            Add New
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex justify-between items-center">
                <span className="text-default-400 text-small">Total {data.length} items</span>
                <label className="flex items-center text-default-400 text-small">
                    Rows per page:
                    <select
                        className="bg-transparent outline-none text-default-400 text-small"
                        value={rowsPerPage}
                        onChange={onRowsPerPageChange}
                    >
                        {rowsPerPageOptions.map((option) => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>
                </label>
            </div>
        </div>
    );

    const bottomContent = (
        <div className="py-2 px-2 flex justify-between items-center gap-2">
            <span className="w-[30%]" />
            <Pagination className="sm:flex" isCompact showShadow color="danger" page={page} total={pages} onChange={setPage} />
            <div className="hidden sm:flex w-[30%] justify-end gap-2">
                <Button isDisabled={page <= 1} size="sm" variant="flat" onPress={() => setPage((p) => p - 1)}>
                    Previous
                </Button>
                <Button isDisabled={page >= pages} size="sm" variant="flat" onPress={() => setPage((p) => p + 1)}>
                    Next
                </Button>
            </div>
        </div>
    );

    return (
        <div className="tableTemplate">
            <Table
                aria-label={ariaLabel}
                isHeaderSticky
                bottomContent={bottomContent}
                bottomContentPlacement="outside"
                classNames={{ wrapper: 'max-h-screen' }}
                sortDescriptor={sortDescriptor}
                topContent={topContent}
                topContentPlacement="outside"
                onSortChange={setSortDescriptor}
                className="bg-white rounded-xl shadow-md p-4"
            >
                <TableHeader columns={headerColumns}>
                    {(column) => (
                        <TableColumn key={column.uid} align={column.uid === 'actions' ? 'center' : 'start'} allowsSorting={column.allowsSorting}>
                            {column.name}
                        </TableColumn>
                    )}
                </TableHeader>
                <TableBody emptyContent="No items found" items={items}>
                    {(item) => (
                        <TableRow key={item.id}>
                            {(columnKey) => <TableCell>{renderCell(item, columnKey)}</TableCell>}
                        </TableRow>
                    )}
                </TableBody>
            </Table>
            <Modal isOpen={Boolean(modalImage)} onClose={() => setModalImage(null)}>
                <ModalContent>
                    <ModalHeader>Proof photo</ModalHeader>
                    <ModalBody>
                        {modalImage && <Image src={modalImage} alt="Check-in or check-out proof" />}
                    </ModalBody>
                </ModalContent>
            </Modal>
        </div>
    );
};

export default TableTemplate;
