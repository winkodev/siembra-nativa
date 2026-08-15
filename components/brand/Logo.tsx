'use client';

import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface LogoProps {
  variant?: 'icon' | 'full' | 'text';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  href?: string;
  className?: string;
}

const sizeMap = {
  sm:  { icon: 32,  text: { width: 120, height: 40 }  },
  md:  { icon: 48,  text: { width: 160, height: 54 }  },
  lg:  { icon: 80,  text: { width: 220, height: 74 }  },
  xl:  { icon: 120, text: { width: 300, height: 100 } },
};

export function Logo({ variant = 'full', size = 'md', href = '/', className }: LogoProps) {
  const dims = sizeMap[size];

  const content = (
    <div className={cn('flex items-center gap-3', className)}>
      {(variant === 'icon' || variant === 'full') && (
        <Image
          src="/images/logo.png"
          alt="Siembra Nativa Club"
          width={dims.icon}
          height={dims.icon}
          className="object-contain drop-shadow-lg"
          priority
        />
      )}
      {(variant === 'text' || variant === 'full') && (
        <Image
          src="/images/logo-text.png"
          alt="Siembra Nativa Club"
          width={dims.text.width}
          height={dims.text.height}
          className="object-contain"
          priority
        />
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center hover:opacity-90 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}
