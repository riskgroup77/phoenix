
import React from 'react';
import EditorialLogo from './EditorialLogo';

const AuthLayout: React.FC<{ children: React.ReactNode; title: string }> = ({ children }) => {
  return (
    <div className="editorial-auth min-h-screen flex flex-col justify-center items-center p-4 motion-safe:animate-[phoenix-main-in_0.6s_ease-out_both]">
      <div className="text-center mb-8 max-w-2xl px-2">
        <div className="flex justify-center mb-6">
          <EditorialLogo to="/" />
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold leading-tight tracking-tight text-[var(--editorial-text)]">
          So&apos;nggi nashrlar va maqolalar
        </h1>
        <p className="mt-3 text-base sm:text-lg text-[var(--editorial-muted)]">
          PINM tizimiga{' '}
          <span className="text-[var(--editorial-primary)] font-semibold">xush kelibsiz</span>
        </p>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
};

export default AuthLayout;
