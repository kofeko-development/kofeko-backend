export const generateSecret = () => 'JBSWY3DPEHPK3PXP';

export const generateURI = (options: { issuer: string; label: string; secret: string }) =>
  `otpauth://totp/${encodeURIComponent(options.issuer)}:${encodeURIComponent(options.label)}?secret=${options.secret}`;

export const verify = async () => ({ valid: true, delta: 0 });

export const generate = async () => '123456';
export const verifySync = () => ({ valid: true, delta: 0 });
