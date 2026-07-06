'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { XCircle, CheckCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1';

export default function WaitlistForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCode = searchParams.get('ref');
  const debounceTimer = useRef<NodeJS.Timeout>();

  const [formData, setFormData] = useState({
    email: '',
    username: '',
    referralCode: referralCode || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData((prev) => ({ ...prev, email: value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Validate username before submission
    if (usernameError) {
      setError('Please choose a different username');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/waitlist/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/waitlist/confirmed');
      }, 1500);
    } catch (err) {
      setError((err as Error).message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const checkUsernameAvailability = async (username: string) => {
    // if the user has already changed the input to something else, bail early
    if (username !== formData.username) {
      // we don't even clear the error here; the caller will rerun once the
      // latest value settles (debounced) or the length drops below the
      // threshold. this avoids flicker caused by out‑of‑order network
      // responses.
      return;
    }

    if (username.length < 3) {
      // short usernames don't hit the API, but we still want to wipe any
      // previous error so that the red message doesn't linger when the user
      // deletes characters.
      setUsernameError('');
      setCheckingUsername(false);
      return;
    }

    try {
      setCheckingUsername(true);
      const response = await fetch(
        `${API_URL}/waitlist/check-username?username=${username}`
      );
      const data = await response.json();
      console.log('Username check response:', data);

      // make sure the response corresponds to the current input; the value
      // could have changed while we were waiting for the network round‑trip
      if (username !== formData.username) return;

      if (!data.available) {
        setUsernameError(data.reason || 'Username is taken');
      } else {
        setUsernameError('');
      }
    } catch (err) {
      console.error('Error checking username:', err);
      // only show an error when the username hasn't already moved on
      if (username === formData.username) {
        setUsernameError('Could not verify username availability');
      }
    } finally {
      if (username === formData.username) {
        setCheckingUsername(false);
      }
    }
  };

  const handleUsernameChange = (value: string) => {
    // Convert to lowercase and validate characters
    const normalized = value.toLowerCase();
    if (!/^[a-z0-9_]*$/.test(normalized) && normalized !== '') {
      return;
    }

    setFormData((prev) => ({ ...prev, username: normalized }));

    // immediately clear any error when the username drops below the
    // minimum length so the UI doesn't linger with a red message while we
    // wait for the debounce to fire.
    if (normalized.length < 3) {
      setUsernameError('');
      setCheckingUsername(false);
    }

    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new timer for debounced check (500ms delay)
    debounceTimer.current = setTimeout(() => {
      checkUsernameAvailability(normalized);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">🧀 Cheese Wallet</h1>
        <p className="text-center text-gray-600 mb-8">Join the waitlist for USDC savings in Nigeria</p>

        {success ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <p className="text-green-700 font-semibold">Registration successful! 🎉</p>
            <p className="text-green-600 text-sm">Redirecting...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleEmailChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username {checkingUsername && <span className="text-gray-500 text-xs">(checking...)</span>}
              </label>
              <input
                type="text"
                name="username"
                required
                minLength={3}
                maxLength={20}
                value={formData.username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition ${
                  usernameError
                    ? 'border-red-300 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-yellow-500'
                }`}
                placeholder="john_doe"
              />
              <p className="text-xs text-gray-500 mt-1">3-20 characters, letters/numbers/underscore only</p>
              {usernameError && (
                <p className="flex items-center gap-1 text-xs text-red-600 mt-1"><XCircle size={12} /> {usernameError}</p>
              )}
              {!usernameError && formData.username.length >= 3 && !checkingUsername && (
                <p className="flex items-center gap-1 text-xs text-green-600 mt-1"><CheckCircle size={12} /> Username available</p>
              )}
            </div>

            {formData.referralCode && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  <strong>Referral:</strong> {formData.referralCode}
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || checkingUsername || !!usernameError}
              className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 text-white font-semibold py-2 rounded-lg transition"
            >
              {loading ? 'Joining...' : 'Join Waitlist'}
            </button>
          </form>
        )}

        <p className="text-center text-gray-600 text-sm mt-6">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-yellow-600 hover:text-yellow-700 font-semibold">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
