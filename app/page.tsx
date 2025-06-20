'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import styles from './page.module.css';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === 'loading') {
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <div className={styles.loadingSpinner}></div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.background}>
        <div className={styles.backgroundShape}></div>
        <div className={styles.backgroundShape}></div>
        <div className={styles.backgroundShape}></div>
      </div>
      
      <main className={styles.main}>
        <div className={styles.content}>
          {!session ? (
            <>
              <div className={styles.logoContainer}>
                <Image
                  src="/calendar-icon.svg"
                  alt="BettrCalendar Logo"
                  width={80}
                  height={80}
                  className={styles.logo}
                />
              </div>
              <h1 className={styles.title}>
                Welcome to <span className={styles.highlight}>BettrCalendar</span>
              </h1>
              <p className={styles.subtitle}>
                Your smarter way to manage time and boost productivity
              </p>
              <button
                className={styles.googleButton}
                onClick={() => signIn('google')}
              >
                <Image
                  src="/google-icon.svg"
                  alt="Google"
                  width={24}
                  height={24}
                  className={styles.googleIcon}
                />
                Sign in with Google
              </button>
            </>
          ) : (
            <>
              <div className={styles.welcomeContainer}>
                <div className={styles.avatarContainer}>
                  {session.user?.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name || 'User'}
                      className={styles.avatar}
                      width={80}
                      height={80}
                    />
                  ) : (
                    <div className={styles.avatarPlaceholder}>
                      {session.user?.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                </div>
                <h1 className={styles.title}>
                  Welcome back, <span className={styles.highlight}>{session.user?.name}</span>
                </h1>
                <p className={styles.subtitle}>
                  Ready to make your day more productive?
                </p>
                <div className={styles.buttonGroup}>
                  <button
                    className={`${styles.calendarButton}`}
                    onClick={() => router.push('/calendar')}
                  >
                    View Calendar
                  </button>
                  <button
                    className={`${styles.signOutButton}`}
                    onClick={() => signOut()}
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
