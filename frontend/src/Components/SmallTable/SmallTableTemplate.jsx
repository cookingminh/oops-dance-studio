import { useMemo, useState } from 'react';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Pagination, User, Chip } from '@nextui-org/react';
import { statusColorMap } from '../Table/utils';
import { AVATAR_DEFAULTS } from '@/ui/avatar';

// Compact read-only table with client-side pagination. Image fields hold ready-to-use URLs.
const SmallTableTemplate = ({ data, columns, rowsPerPage = 4, emptyContent = 'No items found' }) => {
    const [page, setPage] = useState(1);
    const pages = Math.max(1, Math.ceil(data.length / rowsPerPage));

    const items = useMemo(() => {
        const start = (page - 1) * rowsPerPage;
        return data.slice(start, start + rowsPerPage);
    }, [page, data, rowsPerPage]);

    const renderCell = (item, columnKey) => {
        const cellValue = item[columnKey];
        switch (columnKey) {
            case 'status':
                return (
                    <Chip className="capitalize" color={statusColorMap[cellValue] ?? 'default'} size="sm" variant="flat">
                        {cellValue}
                    </Chip>
                );
            case 'class':
                return <User avatarProps={{ ...AVATAR_DEFAULTS, radius: 'lg', src: item.class_img ?? undefined, name: item.class_name }} name={item.class_name} />;
            case 'email':
                return <a href={`mailto:${cellValue}`} className="text-blue-500">{cellValue}</a>;
            case 'user':
                return (
                    <User
                        avatarProps={{ ...AVATAR_DEFAULTS, radius: 'lg', src: item.avatar ?? undefined, name: item.name || item.username }}
                        description={item.email}
                        name={item.name || item.username}
                    />
                );
            default:
                return cellValue ?? '';
        }
    };

    return (
        <Table
            aria-label="Small table"
            bottomContent={
                pages > 1 && (
                    <div className="flex w-full justify-center">
                        <Pagination isCompact showControls showShadow color="danger" page={page} total={pages} onChange={setPage} />
                    </div>
                )
            }
            classNames={{ wrapper: 'min-h-[222px] text-center' }}
        >
            <TableHeader columns={columns}>
                {(column) => <TableColumn key={column.uid}>{column.name}</TableColumn>}
            </TableHeader>
            <TableBody items={items} emptyContent={emptyContent}>
                {(item) => (
                    <TableRow key={item.id}>
                        {(columnKey) => <TableCell>{renderCell(item, columnKey)}</TableCell>}
                    </TableRow>
                )}
            </TableBody>
        </Table>
    );
};

export default SmallTableTemplate;
