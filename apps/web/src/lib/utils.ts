import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

/** Path inside the app, with the deploy base path (/capstone26/CP26SSI3 in prod) for raw <img>/<a> and fetch */
export const withBase = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}${path}`;
