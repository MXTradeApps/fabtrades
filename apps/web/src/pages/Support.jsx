import { useState } from 'react';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Link as MuiLink,
    TextField,
    Typography
} from '@mui/material';
import Header from '../components/elements/Header.jsx';
import { Page, PageHeader, Panel } from '../components/layout/Page.jsx';
import { useCardData } from '../hooks/useCardData.jsx';
import { useDocumentHead } from '../utils/seo.js';
import {
    SUPPORT_CONTACT_EMAIL,
    SUPPORT_FORM_NAME
} from '../content/support.js';

const encode = (data) =>
    Object.keys(data)
        .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key] ?? '')}`)
        .join('&');

const Support = () => {
    const { pricesUpdatedAt: lastUpdatedTimestamp } = useCardData();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [botField, setBotField] = useState('');
    const [status, setStatus] = useState('idle'); // idle | submitting | success | error
    const [errorMessage, setErrorMessage] = useState('');

    useDocumentHead({
        title: 'Support',
        description:
            'Contact FAB Trades support. Send a message with your name, email, ' +
            'and issue description — we typically reply within a few business days.',
        canonicalPath: '/support'
    });

    const linkColor = 'primary.main';

    const handleSubmit = async (event) => {
        event.preventDefault();
        setStatus('submitting');
        setErrorMessage('');

        try {
            const response = await fetch('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: encode({
                    'form-name': SUPPORT_FORM_NAME,
                    'bot-field': botField,
                    name: name.trim(),
                    email: email.trim(),
                    message: message.trim()
                })
            });

            if (!response.ok) {
                throw new Error(`Submission failed (${response.status})`);
            }

            setStatus('success');
            setName('');
            setEmail('');
            setMessage('');
        } catch (err) {
            setStatus('error');
            setErrorMessage(
                err?.message ||
                    'Something went wrong. Please try again or email us directly.'
            );
        }
    };

    return (
        <>
            <Header lastUpdatedTimestamp={lastUpdatedTimestamp} />

            <Page maxWidth={680}>
                <PageHeader
                    title="Support"
                    subtitle={(
                        <>
                            Tell us what&apos;s going on and we&apos;ll get back to you at the
                            email you provide. You can also reach us directly at{' '}
                            <MuiLink
                                href={`mailto:${SUPPORT_CONTACT_EMAIL}`}
                                sx={{ color: linkColor }}
                            >
                                {SUPPORT_CONTACT_EMAIL}
                            </MuiLink>
                            .
                        </>
                    )}
                />

                <Panel sx={{ p: { xs: 2.5, md: 4 } }}>
                    {status === 'success' ? (
                        <Alert severity="success">
                            Thanks — your message was sent. We&apos;ll reply as soon as we can.
                        </Alert>
                    ) : (
                        <Box
                            component="form"
                            name={SUPPORT_FORM_NAME}
                            method="POST"
                            data-netlify="true"
                            data-netlify-honeypot="bot-field"
                            onSubmit={handleSubmit}
                            noValidate
                        >
                            <input type="hidden" name="form-name" value={SUPPORT_FORM_NAME} />
                            {/* Honeypot — leave empty; bots fill it. */}
                            <Box
                                sx={{
                                    position: 'absolute',
                                    left: '-10000px',
                                    height: 0,
                                    overflow: 'hidden'
                                }}
                                aria-hidden="true"
                            >
                                <label>
                                    Don&apos;t fill this out if you&apos;re human:
                                    <input
                                        name="bot-field"
                                        tabIndex={-1}
                                        autoComplete="off"
                                        value={botField}
                                        onChange={(e) => setBotField(e.target.value)}
                                    />
                                </label>
                            </Box>

                            <TextField
                                required
                                fullWidth
                                id="support-name"
                                name="name"
                                label="Name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                margin="normal"
                                autoComplete="name"
                                disabled={status === 'submitting'}
                            />
                            <TextField
                                required
                                fullWidth
                                id="support-email"
                                name="email"
                                type="email"
                                label="E-mail"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                margin="normal"
                                autoComplete="email"
                                disabled={status === 'submitting'}
                            />
                            <TextField
                                required
                                fullWidth
                                id="support-message"
                                name="message"
                                label="Issue description"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                margin="normal"
                                multiline
                                minRows={5}
                                disabled={status === 'submitting'}
                            />

                            {status === 'error' && (
                                <Alert
                                    severity="error"
                                    sx={{ mt: 2, mb: 1 }}
                                >
                                    {errorMessage}{' '}
                                    <MuiLink
                                        href={`mailto:${SUPPORT_CONTACT_EMAIL}`}
                                        sx={{ color: linkColor }}
                                    >
                                        {SUPPORT_CONTACT_EMAIL}
                                    </MuiLink>
                                </Alert>
                            )}

                            <Button
                                type="submit"
                                variant="contained"
                                fullWidth
                                disabled={
                                    status === 'submitting' ||
                                    !name.trim() ||
                                    !email.trim() ||
                                    !message.trim()
                                }
                                size="large"
                                sx={{ mt: 3 }}
                            >
                                {status === 'submitting' ? (
                                    <CircularProgress size={22} color="inherit" />
                                ) : (
                                    'Send message'
                                )}
                            </Button>
                        </Box>
                    )}
                </Panel>
            </Page>
        </>
    );
};

export default Support;
