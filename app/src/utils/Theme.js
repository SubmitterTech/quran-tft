import { memo } from 'react';

export const colorThemes = {
    light: {
        'theme-mode': 'light',
        'status-bar-style': 'light',
        surface: {
            top: 'bg-neutral-50',
            middle: 'bg-neutral-100',
            bottom: 'bg-neutral-200',
            base: 'bg-neutral-300',
            'verse-detail': 'bg-neutral-100',
            encrypted: 'bg-neutral-300',
            relation: 'bg-neutral-400/30',
            'map-top': 'bg-neutral-400/30',
            'map-chip-base': 'bg-neutral-200',
            'map-chip': 'bg-neutral-200',
            'map-chip-active': 'bg-neutral-400/30',
            toast: '#f5f5f5',
            'status-bar': '#d4d4d4'
        },
        text: {
            top: 'text-neutral-900',
            middle: 'text-neutral-800',
            bottom: 'text-neutral-900/60',
            deep: 'text-neutral-900/30',
            logger: 'text-neutral-800/80',
            'table-title': 'text-neutral-700',
            'on-map': 'text-neutral-900',
            'on-map-soft': 'text-neutral-900/60',
            'on-deep': 'text-neutral-900',
            'on-deep-soft': 'text-neutral-900/60'
        },
        border: {
            strong: 'border-neutral-900',
            soft: 'border-neutral-800/80',
            focus: 'ring-neutral-800/80'
        },
        accent: {
            top: 'text-rose-500',
            'on-light': 'text-rose-500',
            'on-deep': 'text-rose-500',
            'map-heading': 'text-rose-500',
            'map-link': 'text-sky-500',
            border: 'border-rose-500',
            'on-deep-border': 'border-rose-500',
            ring: 'ring-rose-500',
            'on-deep-ring': 'ring-rose-500',
            fill: 'bg-rose-500',
            conic: 'bg-[conic-gradient(#f43f5e_20deg,transparent_180deg)]',
            toast: '#f43f5e'
        },
        effect: {
            'focus-ring': 'focus:ring-neutral-800/80',
            'focus-text': 'focus:text-neutral-800',
            'ring-verse': 'ring-neutral-700/50',
            'ring-title': 'ring-neutral-300/50'
        }
    },
    dark: {
        'theme-mode': 'dark',
        'status-bar-style': 'dark',
        surface: {
            top: 'bg-neutral-800',
            middle: 'bg-neutral-700',
            bottom: 'bg-neutral-900',
            base: 'bg-neutral-950',
            'verse-detail': 'bg-neutral-900',
            encrypted: 'bg-neutral-700',
            relation: 'bg-neutral-700',
            'map-top': 'bg-neutral-700',
            'map-chip-base': 'bg-neutral-900',
            'map-chip': 'bg-neutral-900',
            'map-chip-active': 'bg-neutral-700',
            toast: '#171717',
            'status-bar': '#0a0a0a'
        },
        text: {
            top: 'text-neutral-100',
            middle: 'text-neutral-300',
            bottom: 'text-neutral-100/60',
            deep: 'text-neutral-100/30',
            logger: 'text-neutral-300/80',
            'table-title': 'text-neutral-300',
            'on-map': 'text-neutral-100',
            'on-map-soft': 'text-neutral-100/60',
            'on-deep': 'text-neutral-100',
            'on-deep-soft': 'text-neutral-100/60'
        },
        border: {
            strong: 'border-neutral-100',
            soft: 'border-neutral-500/80',
            focus: 'ring-neutral-500/80'
        },
        accent: {
            top: 'text-green-500',
            'on-light': 'text-green-500',
            'on-deep': 'text-green-500',
            'map-heading': 'text-green-500',
            'map-link': 'text-sky-500',
            border: 'border-green-500',
            'on-deep-border': 'border-green-500',
            ring: 'ring-green-500',
            'on-deep-ring': 'ring-green-500',
            fill: 'bg-green-500',
            conic: 'bg-[conic-gradient(#22c55e_20deg,transparent_180deg)]',
            toast: '#22c55e'
        },
        effect: {
            'focus-ring': 'focus:ring-neutral-200/80',
            'focus-text': 'focus:text-neutral-200',
            'ring-verse': 'ring-green-500/70',
            'ring-title': 'ring-neutral-200/70'
        }
    },
    indigo: {
        'theme-mode': 'dark',
        'status-bar-style': 'dark',
        surface: {
            top: 'bg-indigo-900',
            middle: 'bg-neutral-700',
            bottom: 'bg-neutral-800',
            base: 'bg-indigo-950',
            'verse-detail': 'bg-neutral-800',
            encrypted: 'bg-neutral-700',
            relation: 'bg-neutral-700',
            'map-top': 'bg-neutral-700',
            'map-chip-base': 'bg-neutral-800',
            'map-chip': 'bg-neutral-800',
            'map-chip-active': 'bg-neutral-700',
            toast: '#262626',
            'status-bar': '#1e1b4b'
        },
        text: {
            top: 'text-neutral-100',
            middle: 'text-neutral-300',
            bottom: 'text-neutral-100/60',
            deep: 'text-neutral-100/30',
            logger: 'text-neutral-300/80',
            'table-title': 'text-neutral-300',
            'on-map': 'text-neutral-100',
            'on-map-soft': 'text-neutral-100/60',
            'on-deep': 'text-neutral-100',
            'on-deep-soft': 'text-neutral-100/60'
        },
        border: {
            strong: 'border-indigo-100',
            soft: 'border-indigo-500/80',
            focus: 'ring-indigo-500/80'
        },
        accent: {
            top: 'text-lime-400',
            'on-light': 'text-lime-400',
            'on-deep': 'text-lime-400',
            'map-heading': 'text-lime-400',
            'map-link': 'text-sky-500',
            border: 'border-lime-400',
            'on-deep-border': 'border-lime-400',
            ring: 'ring-lime-400',
            'on-deep-ring': 'ring-lime-400',
            fill: 'bg-lime-400',
            conic: 'bg-[conic-gradient(#a3e635_20deg,transparent_180deg)]',
            toast: '#a3e635'
        },
        effect: {
            'focus-ring': 'focus:ring-neutral-200/80',
            'focus-text': 'focus:text-neutral-200',
            'ring-verse': 'ring-lime-400/70',
            'ring-title': 'ring-neutral-200/70'
        }
    },
    green: {
        'theme-mode': 'dark',
        'status-bar-style': 'dark',
        surface: {
            top: 'bg-teal-800',
            middle: 'bg-neutral-700',
            bottom: 'bg-neutral-900',
            base: 'bg-teal-950',
            'verse-detail': 'bg-neutral-800',
            encrypted: 'bg-neutral-700/70',
            relation: 'bg-neutral-700/70',
            'map-top': 'bg-neutral-700/70',
            'map-chip-base': 'bg-neutral-900',
            'map-chip': 'bg-neutral-900',
            'map-chip-active': 'bg-neutral-700/70',
            toast: '#171717',
            'status-bar': '#042f2e'
        },
        text: {
            top: 'text-neutral-200',
            middle: 'text-neutral-300',
            bottom: 'text-neutral-200/60',
            deep: 'text-neutral-200/30',
            logger: 'text-neutral-300/80',
            'table-title': 'text-neutral-300',
            'on-map': 'text-neutral-200',
            'on-map-soft': 'text-neutral-200/60',
            'on-deep': 'text-neutral-200',
            'on-deep-soft': 'text-neutral-200/60'
        },
        border: {
            strong: 'border-teal-100',
            soft: 'border-teal-500/80',
            focus: 'ring-teal-500/80'
        },
        accent: {
            top: 'text-orange-500',
            'on-light': 'text-orange-500',
            'on-deep': 'text-orange-500',
            'map-heading': 'text-orange-500',
            'map-link': 'text-sky-500',
            border: 'border-orange-500',
            'on-deep-border': 'border-orange-500',
            ring: 'ring-orange-500',
            'on-deep-ring': 'ring-orange-500',
            fill: 'bg-orange-500',
            conic: 'bg-[conic-gradient(#f97316_20deg,transparent_180deg)]',
            toast: '#f97316'
        },
        effect: {
            'focus-ring': 'focus:ring-neutral-200/80',
            'focus-text': 'focus:text-neutral-100',
            'ring-verse': 'ring-orange-500/70',
            'ring-title': 'ring-neutral-200/70'
        }
    },
    brown: {
        'theme-mode': 'dark',
        'status-bar-style': 'dark',
        surface: {
            top: 'bg-yellow-900',
            middle: 'bg-neutral-700',
            bottom: 'bg-neutral-900',
            base: 'bg-yellow-950',
            'verse-detail': 'bg-neutral-800',
            encrypted: 'bg-neutral-700/70',
            relation: 'bg-neutral-700/70',
            'map-top': 'bg-neutral-700/70',
            'map-chip-base': 'bg-neutral-900',
            'map-chip': 'bg-neutral-900',
            'map-chip-active': 'bg-neutral-700/70',
            toast: '#171717',
            'status-bar': '#422006'
        },
        text: {
            top: 'text-neutral-50',
            middle: 'text-neutral-300',
            bottom: 'text-neutral-100/60',
            deep: 'text-neutral-100/30',
            logger: 'text-neutral-300/80',
            'table-title': 'text-neutral-300',
            'on-map': 'text-neutral-50',
            'on-map-soft': 'text-neutral-100/60',
            'on-deep': 'text-neutral-50',
            'on-deep-soft': 'text-neutral-100/60'
        },
        border: {
            strong: 'border-yellow-100',
            soft: 'border-yellow-500/80',
            focus: 'ring-yellow-500/80'
        },
        accent: {
            top: 'text-green-500',
            'on-light': 'text-green-500',
            'on-deep': 'text-green-500',
            'map-heading': 'text-green-500',
            'map-link': 'text-sky-500',
            border: 'border-green-500',
            'on-deep-border': 'border-green-500',
            ring: 'ring-green-500',
            'on-deep-ring': 'ring-green-500',
            fill: 'bg-green-500',
            conic: 'bg-[conic-gradient(#22c55e_20deg,transparent_180deg)]',
            toast: '#22c55e'
        },
        effect: {
            'focus-ring': 'focus:ring-neutral-200/80',
            'focus-text': 'focus:text-neutral-200',
            'ring-verse': 'ring-green-500/70',
            'ring-title': 'ring-neutral-200/70'
        }
    },
    sky: {
        'theme-mode': 'dark',
        'status-bar-style': 'dark',
        surface: {
            top: 'bg-sky-800',
            middle: 'bg-neutral-700',
            bottom: 'bg-neutral-800',
            base: 'bg-sky-950',
            'verse-detail': 'bg-neutral-800',
            encrypted: 'bg-neutral-700/90',
            relation: 'bg-neutral-700/90',
            'map-top': 'bg-neutral-700/90',
            'map-chip-base': 'bg-neutral-800',
            'map-chip': 'bg-neutral-800',
            'map-chip-active': 'bg-neutral-700/90',
            toast: '#262626',
            'status-bar': '#082f49'
        },
        text: {
            top: 'text-neutral-100',
            middle: 'text-neutral-300',
            bottom: 'text-sky-100/60',
            deep: 'text-sky-100/30',
            logger: 'text-neutral-300/80',
            'table-title': 'text-neutral-300',
            'on-map': 'text-neutral-100',
            'on-map-soft': 'text-sky-100/60',
            'on-deep': 'text-neutral-100',
            'on-deep-soft': 'text-sky-100/60'
        },
        border: {
            strong: 'border-sky-100',
            soft: 'border-sky-500/80',
            focus: 'ring-sky-500/80'
        },
        accent: {
            top: 'text-amber-400',
            'on-light': 'text-amber-400',
            'on-deep': 'text-amber-400',
            'map-heading': 'text-amber-400',
            'map-link': 'text-sky-500',
            border: 'border-amber-400',
            'on-deep-border': 'border-amber-400',
            ring: 'ring-amber-300',
            'on-deep-ring': 'ring-amber-300',
            fill: 'bg-amber-400',
            conic: 'bg-[conic-gradient(#fbbf24_20deg,transparent_180deg)]',
            toast: '#fbbf24'
        },
        effect: {
            'focus-ring': 'focus:ring-neutral-200/80',
            'focus-text': 'focus:text-neutral-200',
            'ring-verse': 'ring-amber-400/70',
            'ring-title': 'ring-neutral-200/70'
        }
    },
    leaf: {
        'theme-mode': 'light',
        'status-bar-style': 'light',
        surface: {
            top: 'bg-[#ffe6a7]',
            middle: 'bg-[#f3ddb0]',
            bottom: 'bg-[#e6ca94]',
            base: 'bg-[#414833]',
            'verse-detail': 'bg-[#f3ddb0]',
            encrypted: 'bg-[#36472f]',
            relation: 'bg-[#2c3d2c]',
            'map-top': 'bg-[#2a3a29]',
            'map-chip-base': 'bg-[#223021]',
            'map-chip': 'bg-[#223021]',
            'map-chip-active': 'bg-[#3b5237]',
            toast: '#f3ddb0',
            'status-bar': '#414833'
        },
        text: {
            top: 'text-[#3f3323]',
            middle: 'text-[#4f3c29]',
            bottom: 'text-[#4f3c29]/60',
            deep: 'text-[#4f3c29]/30',
            logger: 'text-[#4f3c29]/80',
            'table-title': 'text-[#5e472f]',
            'on-deep': 'text-[#f3ddb0]',
            'on-deep-soft': 'text-[#f3ddb0]/70',
            'on-deep-placeholder': 'placeholder:text-[#f3ddb0]/70',
            'on-detail': 'text-[#fff6df]',
            'on-detail-soft': 'text-[#f3ddb0]/70',
            'on-map': 'text-[#f3ddb0]',
            'on-map-soft': 'text-[#f3ddb0]/70'
        },
        border: {
            strong: 'border-[#7f5539]',
            soft: 'border-[#7f5539]/80',
            focus: 'ring-[#7f5539]/80'
        },
        accent: {
            top: 'text-lime-600',
            'on-light': 'text-green-500',
            'on-deep': 'text-lime-500',
            'map-heading': 'text-lime-500',
            'map-link': 'text-lime-500',
            border: 'border-green-500',
            'on-deep-border': 'border-lime-500',
            ring: 'ring-green-400/80',
            'on-deep-ring': 'ring-lime-400/90',
            fill: 'bg-green-500',
            conic: 'bg-[conic-gradient(#22c55e_20deg,transparent_180deg)]',
            toast: '#16a34a'
        },
        effect: {
            'focus-ring': 'focus:ring-green-600/70',
            'focus-text': 'focus:text-[#f3ddb0]',
            'ring-verse': 'ring-green-600/70',
            'ring-title': 'ring-[#f3ddb0]/70'
        }
    }
};

export const ColorPicker = memo(({ theme, colors, onChangeColor }) => {
    return (
        <div className={`grid grid-flow-dense grid-cols-3 md:grid-cols-4 gap-2 w-full`}>
            {Object.entries(colors).map(([localTheme, themeColors]) => (
                <label
                    key={localTheme}
                    data-theme-option={localTheme}
                    data-selected-theme={localTheme === theme ? "true" : "false"}
                    className="flex cursor-pointer flex-1 items-stretch">
                    <input
                        type="radio"
                        name="theme"
                        value={localTheme}
                        onChange={(e) => onChangeColor(e.target.value)}
                        aria-label={localTheme}
                        className="hidden"
                    />
                    <span
                        title={localTheme}
                        className={`relative flex flex-col items-stretch justify-center rounded p-1.5 flex-1 ${themeColors["surface"]["base"]} ${localTheme === theme ? `border-2 ${themeColors["accent"]["border"]}` : "border border-gray-400/70"} min-h-[76px] md:min-h-24`}>
                        <span className={`rounded-sm w-full h-8 md:h-9 px-1.5 py-1.5 flex flex-col justify-center gap-1 ${themeColors["surface"]["top"]}`}>
                            <span className={`block h-[2px] rounded-full bg-current ${themeColors["text"]["top"]}`} />
                            <span className={`block h-[2px] rounded-full bg-current w-4/5 ${themeColors["text"]["middle"]}`} />
                        </span>
                        <span className={`h-1.5 rounded-sm w-full mt-1 ${themeColors["accent"]["fill"]}`} />
                        <span className="grid grid-cols-4 gap-0.5 mt-1.5">
                            <span className={`h-2.5 rounded ${themeColors['surface']['top']}`} />
                            <span className={`h-2.5 rounded ${themeColors['surface']['relation']}`} />
                            <span className={`h-2.5 rounded ${themeColors['surface']['bottom']}`} />
                            <span className={`h-2.5 rounded ${themeColors['surface']['base']}`} />
                        </span>
                        {localTheme === theme && (
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                className={`${themeColors["accent"]["top"]} absolute right-1 bottom-1 w-4 h-4`}>
                                <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                            </svg>
                        )}
                    </span>
                </label>
            ))}
        </div>
    );
});

export const FontPicker = memo(({ theme, colors, font, onChangeFont, compact = false }) => {
    const activeLang = (typeof window !== 'undefined' ? localStorage.getItem('lang') : '') || '';
    const sansPreviewFamily = activeLang.toLowerCase() === 'fa'
        ? 'Vazirmatn, ui-sans-serif, system-ui, sans-serif'
        : 'ui-sans-serif, system-ui, sans-serif';
    const containerClassName = compact
        ? 'flex flex-col space-y-4 w-full h-full text-lg'
        : 'flex flex-row gap-3 w-full text-base';
    const labelClassName = 'flex cursor-pointer flex-1 items-stretch min-w-0';
    const buttonClassName = compact
        ? `flex flex-col items-center justify-center rounded flex-1 ${colors[theme]["surface"]["top"]} ${colors[theme]["text"]["top"]}`
        : `flex items-center justify-center rounded flex-1 px-2 ${colors[theme]["surface"]["top"]} ${colors[theme]["text"]["top"]}`;
    const selectedBorderClass = `${colors[theme]["accent"]["border"]} border-2`;
    const idleBorderClass = compact ? 'border border-gray-400/70' : `${colors[theme]["border"]["soft"]} border-2`;

    return (
        <div className={containerClassName}>

            <label key={`sans`} className={labelClassName}>
                <input
                    type="radio"
                    name="theme"
                    value={`font-normal`}
                    onChange={(e) => onChangeFont(e.target.value)}
                    className="hidden"
                />
                <div
                    className={`${buttonClassName} ${`font-normal` === font ? selectedBorderClass : idleBorderClass} ${compact ? 'h-20' : 'h-12 px-2'}`}>
                    {compact ? (
                        <>
                            <div style={{ fontFamily: sansPreviewFamily }}>{`Q`}</div>
                            <div style={{ fontFamily: sansPreviewFamily }} className={`text-xl -mt-2 !font-normal`}>{`ق`}</div>
                            <div style={{ fontFamily: sansPreviewFamily }} className={`text-base`}>{`57`}</div>
                        </>
                    ) : (
                        <div className="w-full flex items-center justify-center gap-5 leading-none">
                            <div style={{ fontFamily: sansPreviewFamily }} className="text-3xl">{`Q`}</div>
                            <div style={{ fontFamily: sansPreviewFamily }} className="text-[2rem] mb-2.5 !font-normal">{`ق`}</div>
                            <div style={{ fontFamily: sansPreviewFamily }} className="text-2xl">{`57`}</div>
                        </div>
                    )}
                </div>
            </label>

            <label key={`serif`} className={labelClassName}>
                <input
                    type="radio"
                    name="theme"
                    value={`font-serif`}
                    onChange={(e) => onChangeFont(e.target.value)}
                    className="hidden"
                />
                <div
                    className={`${buttonClassName} ${`font-serif` === font ? selectedBorderClass : idleBorderClass} ${compact ? 'h-20' : 'h-12 px-2'}`}>
                    {compact ? (
                        <>
                            <div style={{ fontFamily: 'serif' }}>{`Q`}</div>
                            <div style={{ fontFamily: 'serif' }} className={`text-xl -mt-1.5`}>{`ق`}</div>
                            <div style={{ fontFamily: 'serif' }} className={`text-base -mt-0.5`}>{`57`}</div>
                        </>
                    ) : (
                        <div className="w-full flex items-center justify-center gap-5 leading-none">
                            <div style={{ fontFamily: 'serif' }} className="text-3xl">{`Q`}</div>
                            <div style={{ fontFamily: 'serif' }} className="text-[2rem] mb-2">{`ق`}</div>
                            <div style={{ fontFamily: 'serif' }} className="text-2xl pt-1">{`57`}</div>
                        </div>
                    )}
                </div>
            </label>

        </div>
    );
});
