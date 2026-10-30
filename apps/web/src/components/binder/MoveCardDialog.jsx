import { useEffect, useState } from 'react';
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    TextField,
} from '@mui/material';

/**
 * "Move to Binder": picks a destination Binder (and how many copies) for one card.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {(choice: { toBinderId: string, quantity: number }) => Promise<void>|void} props.onConfirm
 * @param {Array<{ clientId: string, name: string }>} props.destinations - Binders the card can move into.
 * @param {string} [props.cardName]
 * @param {number} [props.maxQuantity] - Copies of the card in the open Binder.
 */
export default function MoveCardDialog({
    open,
    onClose,
    onConfirm,
    destinations,
    cardName = '',
    maxQuantity = 1,
}) {
    const [toBinderId, setToBinderId] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) return;
        setToBinderId(destinations[0]?.clientId || '');
        setQuantity('1');
        setBusy(false);
    }, [open, destinations]);

    const qty = Number(quantity);
    const qtyValid = Number.isInteger(qty) && qty >= 1 && qty <= maxQuantity;
    const canMove = Boolean(toBinderId) && qtyValid && !busy;

    const submit = async (e) => {
        e?.preventDefault();
        if (!canMove) return;
        setBusy(true);
        await onConfirm({ toBinderId, quantity: qty });
        setBusy(false);
    };

    return (
        <Dialog open={open} onClose={() => !busy && onClose()} maxWidth="xs" fullWidth>
            <form onSubmit={submit}>
                <DialogTitle>{cardName ? `Move ${cardName}` : 'Move to Binder'}</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
                    <FormControl fullWidth size="small">
                        <InputLabel id="move-card-binder-label">Move to</InputLabel>
                        <Select
                            labelId="move-card-binder-label"
                            label="Move to"
                            value={toBinderId}
                            onChange={(e) => setToBinderId(e.target.value)}
                            data-testid="move-card-binder"
                            autoFocus
                        >
                            {destinations.map((b) => (
                                <MenuItem key={b.clientId} value={b.clientId}>
                                    {b.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    {maxQuantity > 1 && (
                        <TextField
                            label="Copies"
                            type="number"
                            size="small"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            error={!qtyValid}
                            helperText={`You have ${maxQuantity} in this Binder`}
                            inputProps={{ min: 1, max: maxQuantity, step: 1, 'data-testid': 'move-card-quantity' }}
                        />
                    )}
                </DialogContent>
                <DialogActions>
                    <Button color="inherit" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={!canMove}
                        data-testid="move-card-confirm"
                    >
                        {busy ? 'Moving…' : 'Move'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
