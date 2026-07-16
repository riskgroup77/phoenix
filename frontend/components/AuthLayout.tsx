
import React from 'react';

const AuthLayout: React.FC<{ children: React.ReactNode, title: string }> = ({ children, title }) => {
    return (
        <div className="min-h-screen bg-transparent flex flex-col justify-center items-center p-4 motion-safe:animate-[phoenix-main-in_0.6s_ease-out_both]">
             <div className="text-center mb-8 max-w-2xl px-2">
                <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight phoenix-gradient-title">
                  Phoenix Ilmiy Nashrlar Markazi
                </h1>
                <p className="mt-4 text-lg sm:text-xl text-slate-600 font-medium">
                  PINM tizimiga{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-600 font-semibold">
                    xush kelibsiz
                  </span>
                </p>
            </div>
            <div className="w-full max-w-md">
                {children}
            </div>
        </div>
    );
};

export default AuthLayout;