import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function GET() {
  console.log('Calendar events API route called');
  
  try {
    console.log('Getting server session...');
    const session = await getServerSession(authOptions);
    console.log('Session:', session ? 'Found' : 'Not found');

    if (!session) {
      console.log('No session found, returning 401');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.accessToken) {
      console.log('No access token in session, returning 401');
      return NextResponse.json({ error: 'No access token' }, { status: 401 });
    }

    console.log('Creating OAuth2 client...');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXTAUTH_URL + '/api/auth/callback/google'
    );

    console.log('Setting credentials...');
    oauth2Client.setCredentials({
      access_token: session.accessToken,
    });

    // Verify the token
    try {
      console.log('Verifying token...');
      const tokenInfo = await oauth2Client.getTokenInfo(session.accessToken);
      console.log('Token info:', tokenInfo);
      
      if (!tokenInfo.scopes?.includes('https://www.googleapis.com/auth/calendar')) {
        console.log('Token missing calendar scope');
        return NextResponse.json(
          { error: 'Token missing calendar scope. Please sign out and sign in again.' },
          { status: 403 }
        );
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      return NextResponse.json(
        { error: 'Invalid access token. Please sign out and sign in again.' },
        { status: 401 }
      );
    }

    console.log('Creating calendar client...');
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Get events for the next 30 days instead of just the current month
    const now = new Date();
    const thirtyDaysLater = new Date(now);
    thirtyDaysLater.setDate(now.getDate() + 30);

    console.log('Fetching calendar events...');
    console.log('Time range:', {
      start: now.toISOString(),
      end: thirtyDaysLater.toISOString()
    });

    // First, try to get the calendar list to verify access
    let calendarList;
    try {
      calendarList = await calendar.calendarList.list();
      console.log('Available calendars:', calendarList.data.items?.map(cal => cal.summary));
    } catch (error) {
      console.error('Error fetching calendar list:', error);
      return NextResponse.json(
        { error: 'Failed to access calendar. Please check your Google Calendar permissions.' },
        { status: 403 }
      );
    }

    // Fetch events from all available calendars
    const allCalendars = calendarList.data.items || [];
    let allEvents: import('googleapis').calendar_v3.Schema$Event[] = [];

    for (const cal of allCalendars) {
      try {
        const response = await calendar.events.list({
          calendarId: cal.id!,
          timeMin: now.toISOString(),
          timeMax: thirtyDaysLater.toISOString(),
          maxResults: 100,
          singleEvents: true,
          orderBy: 'startTime',
          showDeleted: false,
          showHiddenInvitations: false,
        });
        if (response.data.items && response.data.items.length > 0) {
          allEvents = allEvents.concat(response.data.items.map(ev => ({ ...ev, _calendarSummary: cal.summary })));
        }
      } catch (err) {
        console.error(`Failed to fetch events for calendar ${cal.summary}:`, err);
      }
    }

    console.log('Total events fetched from all calendars:', allEvents.length);
    if (allEvents.length > 0) {
      console.log('First event details:', JSON.stringify(allEvents[0], null, 2));
    }
    return NextResponse.json(allEvents);
  } catch (error) {
    console.error('Error in calendar events API:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    }
    return NextResponse.json(
      { error: 'Failed to fetch calendar events' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!session.accessToken) {
      return NextResponse.json({ error: 'No access token' }, { status: 401 });
    }
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXTAUTH_URL + '/api/auth/callback/google'
    );
    oauth2Client.setCredentials({ access_token: session.accessToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const body = await req.json();
    // Use primary calendar for event creation
    const event = {
      summary: body.summary,
      description: body.description,
      location: body.location,
      start: body.start,
      end: body.end,
      attendees: body.attendees,
      recurrence: body.recurrence,
      colorId: body.colorId,
    };
    // Remove undefined/null fields
    Object.keys(event).forEach(key => (event as Record<string, unknown>)[key] == null && delete (event as Record<string, unknown>)[key]);
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
} 