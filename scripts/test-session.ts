import fetch from 'node-fetch';

async function testSession() {
  try {
    console.log('1. Testing login...');
    
    // First, login to get session cookie
    const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:5000';
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: process.env.TEST_EMAIL || 'test@example.com',
        password: process.env.TEST_PASSWORD || 'testpassword123'
      })
    });

    console.log('Login status:', loginResponse.status);
    
    if (loginResponse.status !== 200) {
      const errorText = await loginResponse.text();
      console.log('Login failed:', errorText);
      return;
    }

    // Get session cookie from login response
    const setCookieHeader = loginResponse.headers.get('set-cookie');
    console.log('Set-Cookie header:', setCookieHeader);
    
    if (!setCookieHeader) {
      console.log('No session cookie received');
      return;
    }

    // Extract session cookie
    const sessionCookie = setCookieHeader.split(';')[0];
    console.log('Session cookie:', sessionCookie);

    console.log('2. Testing user endpoint with session cookie...');
    
    // Now test the user endpoint with the session cookie
    const userResponse = await fetch(`${baseUrl}/api/auth/user`, {
      headers: {
        'Cookie': sessionCookie
      }
    });

    console.log('User endpoint status:', userResponse.status);
    const userText = await userResponse.text();
    console.log('User endpoint response:', userText);
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testSession();