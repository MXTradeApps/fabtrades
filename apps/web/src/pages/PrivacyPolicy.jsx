import {
    Box,
    Typography,
    Link as MuiLink
} from '@mui/material';
import Header from '../components/elements/Header.jsx';
import { Page, PageHeader, Panel } from '../components/layout/Page.jsx';
import { useCardData } from '../hooks/useCardData.jsx';
import { useDocumentHead } from '../utils/seo.js';
import {
    privacySections,
    PRIVACY_EFFECTIVE_DATE,
    PRIVACY_CONTACT_EMAIL
} from '../content/privacyPolicy.js';

// Renders URLs and the contact email inside policy text as real links.
const linkify = (text, linkColor) => {
    const pattern = /(https?:\/\/[^\s.,)]+(?:\.[^\s.,)]+)*|[\w.+-]+@[\w-]+\.[\w.]+)/g;
    const parts = text.split(pattern);
    return parts.map((part, i) => {
        if (/^https?:\/\//.test(part)) {
            return (
                <MuiLink key={i} href={part} target="_blank" rel="noopener noreferrer" sx={{ color: linkColor }}>
                    {part}
                </MuiLink>
            );
        }
        if (part === PRIVACY_CONTACT_EMAIL) {
            return (
                <MuiLink key={i} href={`mailto:${part}`} sx={{ color: linkColor }}>
                    {part}
                </MuiLink>
            );
        }
        return part;
    });
};

const PrivacyPolicy = () => {
    const { pricesUpdatedAt: lastUpdatedTimestamp } = useCardData();

    useDocumentHead({
        title: 'Privacy Policy',
        description:
            'Privacy policy for FAB Trades: what information the fabtrades.net ' +
            'website and the FAB Trades mobile app collect, how it is used, and ' +
            'your rights.',
        canonicalPath: '/privacy'
    });

    const textColor = 'text.primary';
    const linkColor = 'primary.main';

    return (
        <>
            <Header lastUpdatedTimestamp={lastUpdatedTimestamp} />

            <Page maxWidth={820}>
                <PageHeader title="Privacy Policy" subtitle={`Effective date: ${PRIVACY_EFFECTIVE_DATE}`} />

                <Panel component="article" sx={{ p: { xs: 2.5, md: 5 } }}>
                    {privacySections.map((section) => (
                        <Box key={section.heading} component="section" sx={{ mb: 4, '&:last-child': { mb: 0 } }}>
                            <Typography
                                variant="h4"
                                component="h2"
                                sx={{ color: textColor, mb: 1.25 }}
                            >
                                {section.heading}
                            </Typography>
                            {section.body.map((item, idx) =>
                                item.type === 'ul' ? (
                                    <Box component="ul" key={idx} sx={{ pl: 3, my: 1 }}>
                                        {item.items.map((li, liIdx) => (
                                            <Typography
                                                component="li"
                                                variant="body2"
                                                key={liIdx}
                                                sx={{ color: textColor, mb: 1, lineHeight: 1.7, maxWidth: '68ch' }}
                                            >
                                                {linkify(li, linkColor)}
                                            </Typography>
                                        ))}
                                    </Box>
                                ) : (
                                    <Typography
                                        variant="body2"
                                        key={idx}
                                        sx={{ color: textColor, mb: 1.5, lineHeight: 1.75, maxWidth: '68ch' }}
                                    >
                                        {linkify(item.text, linkColor)}
                                    </Typography>
                                )
                            )}
                        </Box>
                    ))}
                </Panel>
            </Page>
        </>
    );
};

export default PrivacyPolicy;
