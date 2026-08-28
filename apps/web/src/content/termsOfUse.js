/**
 * Terms of Use (EULA) for FAB Trades (fabtrades.net + the FAB Trades mobile
 * app). Kept as plain data so the same text is rendered both by the interactive
 * React page (src/pages/TermsOfUse.jsx) and by the build-time SEO prerenderer
 * (scripts/generateSeoPages.js), which emits a static, crawlable
 * /terms/index.html — App Store Connect requires a functional Terms of Use
 * (EULA) URL for apps that offer auto-renewable subscriptions.
 *
 * Body item types: { type: 'p', text } for a paragraph and
 * { type: 'ul', items: [...] } for a bulleted list.
 */

export const TERMS_EFFECTIVE_DATE = 'August 28, 2026';

export const TERMS_CONTACT_EMAIL = 'mxbloombusiness@gmail.com';

export const termsSections = [
    {
        heading: 'Agreement',
        body: [
            {
                type: 'p',
                text:
                    'These Terms of Use ("Terms") govern your access to and use of the ' +
                    'fabtrades.net website (the "Website") and the FAB Trades mobile ' +
                    'application for Android and iOS (the "App") — together, the ' +
                    '"Services" — operated by FAB Trades ("we", "us", or "our"). By ' +
                    'using the Services, you agree to these Terms. If you do not agree, ' +
                    'do not use the Services.'
            },
            {
                type: 'p',
                text:
                    'FAB Trades is a free, fan-made trade balancer and price guide for ' +
                    'the Flesh and Blood trading card game. FAB Trades is not affiliated ' +
                    'with, endorsed by, or sponsored by Legend Story Studios or ' +
                    'TCGplayer. Card names and images are the property of their ' +
                    'respective owners.'
            }
        ]
    },
    {
        heading: 'The Services',
        body: [
            {
                type: 'p',
                text:
                    'The Services help you look up card prices, balance trades, manage a ' +
                    'collection and want list, and (optionally) sync that data across ' +
                    'devices when you sign in. We may change, suspend, or discontinue any ' +
                    'part of the Services at any time.'
            },
            {
                type: 'p',
                text:
                    'Price information is provided for convenience only and may be ' +
                    'incomplete, delayed, or inaccurate. You are responsible for ' +
                    'confirming values before completing any real-world trade or purchase.'
            }
        ]
    },
    {
        heading: 'Accounts',
        body: [
            {
                type: 'p',
                text:
                    'You can use most features of the Services without an account, ' +
                    'including purchasing FABTrades Pro. Signing in is optional and ' +
                    'enables cloud sync and carrying Pro to your other devices. You are ' +
                    'responsible for activity under your account and for keeping your ' +
                    'sign-in credentials secure. You must provide accurate information ' +
                    'and be at least 13 years old (or the minimum age required in your ' +
                    'jurisdiction).'
            }
        ]
    },
    {
        heading: 'FABTrades Pro Subscriptions',
        body: [
            {
                type: 'p',
                text:
                    'FABTrades Pro is an optional auto-renewable subscription that unlocks ' +
                    'paid features in the App. You can subscribe without creating a FAB ' +
                    'Trades account; signing in afterward is optional if you want Pro on ' +
                    'other devices. Subscriptions are offered as:'
            },
            {
                type: 'ul',
                items: [
                    'FABTrades Pro Monthly — one-month auto-renewable subscription.',
                    'FABTrades Pro Yearly — one-year auto-renewable subscription.'
                ]
            },
            {
                type: 'p',
                text:
                    'Payment is charged to your Apple ID or Google Play account at ' +
                    'confirmation of purchase. The subscription automatically renews ' +
                    'unless auto-renew is turned off at least 24 hours before the end of ' +
                    'the current period. Your account will be charged for renewal within ' +
                    '24 hours prior to the end of the current period at the then-current ' +
                    'price. You can manage or cancel your subscription in your device\'s ' +
                    'account settings (App Store or Google Play subscription management) ' +
                    'after purchase.'
            },
            {
                type: 'p',
                text:
                    'Any unused portion of a free trial, if offered, is forfeited when ' +
                    'you purchase a subscription where applicable. Prices shown in the ' +
                    'App are the current offer prices for your storefront and may vary by ' +
                    'region.'
            }
        ]
    },
    {
        heading: 'Acceptable Use',
        body: [
            {
                type: 'p',
                text: 'You agree not to:'
            },
            {
                type: 'ul',
                items: [
                    'Use the Services for any unlawful purpose.',
                    'Attempt to access systems or data you are not authorized to access.',
                    'Interfere with or disrupt the Services, including by scraping, ' +
                        'overloading, or reverse-engineering non-public parts of the App ' +
                        'or Website beyond what applicable law allows.',
                    'Misrepresent your identity or affiliation when using the Services.'
                ]
            }
        ]
    },
    {
        heading: 'Intellectual Property',
        body: [
            {
                type: 'p',
                text:
                    'We and our licensors own the Services\' software, design, and ' +
                    'branding. Flesh and Blood card names, artwork, and related marks ' +
                    'belong to their respective owners. You may not copy, modify, or ' +
                    'redistribute the Services except as expressly allowed by these Terms ' +
                    'or applicable law.'
            }
        ]
    },
    {
        heading: 'Disclaimer of Warranties',
        body: [
            {
                type: 'p',
                text:
                    'THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT ' +
                    'WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING ' +
                    'IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR ' +
                    'PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICES ' +
                    'WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT PRICE DATA WILL BE ' +
                    'ACCURATE OR COMPLETE.'
            }
        ]
    },
    {
        heading: 'Limitation of Liability',
        body: [
            {
                type: 'p',
                text:
                    'TO THE MAXIMUM EXTENT PERMITTED BY LAW, FAB TRADES AND ITS ' +
                    'OPERATORS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, ' +
                    'CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR ' +
                    'GOODWILL, ARISING FROM YOUR USE OF THE SERVICES. OUR TOTAL LIABILITY ' +
                    'FOR ANY CLAIM RELATING TO THE SERVICES WILL NOT EXCEED THE AMOUNT ' +
                    'YOU PAID US FOR FABTRADES PRO IN THE TWELVE MONTHS BEFORE THE CLAIM, ' +
                    'OR USD $50 IF YOU HAVE NOT PAID US.'
            }
        ]
    },
    {
        heading: 'Privacy',
        body: [
            {
                type: 'p',
                text:
                    'Our Privacy Policy at https://fabtrades.net/privacy explains how we ' +
                    'collect, use, and share information. By using the Services, you also ' +
                    'agree to that policy.'
            }
        ]
    },
    {
        heading: 'Apple-Required Terms',
        body: [
            {
                type: 'p',
                text:
                    'If you downloaded the App from the Apple App Store, you acknowledge ' +
                    'that these Terms are between you and FAB Trades only, not Apple, and ' +
                    'that Apple is not responsible for the App or its content. Apple has ' +
                    'no obligation to provide maintenance or support for the App. To the ' +
                    'maximum extent permitted by law, Apple has no warranty obligation ' +
                    'with respect to the App. Apple is not responsible for addressing any ' +
                    'claims by you or a third party relating to the App or your ' +
                    'possession and use of it, including product liability claims, ' +
                    'claims that the App fails to conform to legal or regulatory ' +
                    'requirements, and claims arising under consumer protection or ' +
                    'similar legislation. Apple is not responsible for the investigation, ' +
                    'defense, settlement, or discharge of any third-party claim that the ' +
                    'App or your possession and use of it infringes that third party\'s ' +
                    'intellectual property rights. Apple and Apple\'s subsidiaries are ' +
                    'third-party beneficiaries of these Terms, and upon your acceptance ' +
                    'of these Terms, Apple will have the right to enforce these Terms ' +
                    'against you as a third-party beneficiary.'
            }
        ]
    },
    {
        heading: 'Changes',
        body: [
            {
                type: 'p',
                text:
                    'We may update these Terms from time to time. Changes will be posted ' +
                    'on this page with an updated effective date. Continued use of the ' +
                    'Services after changes take effect constitutes acceptance of the ' +
                    'revised Terms.'
            }
        ]
    },
    {
        heading: 'Contact Us',
        body: [
            {
                type: 'p',
                text:
                    'If you have questions about these Terms, contact us at: ' +
                    TERMS_CONTACT_EMAIL
            }
        ]
    }
];
