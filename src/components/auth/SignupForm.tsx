import React, { useState } from 'react';
import { auth } from '@/lib/firebase'; // Assuming your firebase config is in this path
import { createUserWithEmailAndPassword } from 'firebase/auth';

const SignupForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // User signed up successfully
    } catch (error: any) {
      console.error("Error signing up:", error.message);
    }
  };

  return (
    <div>
      <h2>Sign Up</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email:</label>
          <input type="email" id="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="password">Password:</label>
          <input type="password" id="password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button type="submit">
          Sign Up
        </button>
      </form>
    </div>
  );
};

export default SignupForm;