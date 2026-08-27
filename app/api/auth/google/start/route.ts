import {NextResponse} from 'next/server';
import crypto from 'crypto';
import {authUrl} from '@/lib/google';
export async function GET(){if(!process.env.GOOGLE_CLIENT_ID||!process.env.GOOGLE_CLIENT_SECRET)return NextResponse.json({error:'Faltan variables de Google en Vercel'},{status:500});const state=crypto.randomBytes(24).toString('hex');const res=NextResponse.redirect(authUrl(state));res.cookies.set('autojobs_oauth_state',state,{httpOnly:true,secure:true,sameSite:'lax',maxAge:600,path:'/'});return res;}
