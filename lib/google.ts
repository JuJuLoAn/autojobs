import crypto from 'crypto';

const clientId=()=>process.env.GOOGLE_CLIENT_ID!;
const clientSecret=()=>process.env.GOOGLE_CLIENT_SECRET!;
const redirectUri='https://autojobs-ruddy.vercel.app/api/auth/google/callback';
const scope='https://www.googleapis.com/auth/gmail.readonly';

function key(){return crypto.createHash('sha256').update(clientSecret()).digest();}
export function encrypt(value:string){const iv=crypto.randomBytes(12);const cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);const enc=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);const tag=cipher.getAuthTag();return Buffer.concat([iv,tag,enc]).toString('base64url');}
export function decrypt(value:string){const b=Buffer.from(value,'base64url');const iv=b.subarray(0,12),tag=b.subarray(12,28),enc=b.subarray(28);const decipher=crypto.createDecipheriv('aes-256-gcm',key(),iv);decipher.setAuthTag(tag);return Buffer.concat([decipher.update(enc),decipher.final()]).toString('utf8');}
export function authUrl(state:string){const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');u.searchParams.set('client_id',clientId());u.searchParams.set('redirect_uri',redirectUri);u.searchParams.set('response_type','code');u.searchParams.set('scope',scope);u.searchParams.set('access_type','offline');u.searchParams.set('prompt','consent');u.searchParams.set('state',state);return u.toString();}
export async function exchangeCode(code:string){const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:clientId(),client_secret:clientSecret(),redirect_uri:redirectUri,grant_type:'authorization_code'})});if(!r.ok)throw new Error(await r.text());return r.json();}
export async function accessFromRefresh(refresh_token:string){const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({refresh_token,client_id:clientId(),client_secret:clientSecret(),grant_type:'refresh_token'})});if(!r.ok)throw new Error(await r.text());return r.json();}
export function decodeBody(data?:string){if(!data)return'';return Buffer.from(data.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8');}
export function flattenParts(p:any):string{let out=decodeBody(p?.body?.data);for(const c of p?.parts||[])out+='\n'+flattenParts(c);return out;}
