/**
 * Media proxy — fetches WhatsApp media from Meta and streams it to the client.
 * GET /api/media?id=<wa_media_id>&channel_id=<channel_id>
 *
 * WhatsApp media IDs are not URLs. Must call Meta API with the channel's
 * access_token to get a temporary download URL, then stream the file.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const GRAPH_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  const mediaId = req.nextUrl.searchParams.get('id');
  const channelId = req.nextUrl.searchParams.get('channel_id');

  if (!mediaId || !channelId) {
    return NextResponse.json({ error: 'id and channel_id required' }, { status: 400 });
  }

  // Get channel access token
  const { data: channel } = await adminSupabase
    .from('whatsapp_channels')
    .select('access_token')
    .eq('id', channelId)
    .single();

  if (!channel?.access_token) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  }

  // Step 1: get the download URL from Meta
  const metaRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`,
    { headers: { Authorization: `Bearer ${channel.access_token}` } },
  );

  if (!metaRes.ok) {
    const err = await metaRes.json().catch(() => ({}));
    return NextResponse.json({ error: err?.error?.message || 'Meta API error' }, { status: 502 });
  }

  const { url: downloadUrl } = await metaRes.json();
  if (!downloadUrl) {
    return NextResponse.json({ error: 'No download URL from Meta' }, { status: 502 });
  }

  // Step 2: download the file and stream it
  const fileRes = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${channel.access_token}` },
  });

  if (!fileRes.ok) {
    return NextResponse.json({ error: 'Failed to download media' }, { status: 502 });
  }

  const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';
  const buffer = await fileRes.arrayBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600', // cache 1h — Meta URLs expire but our proxy doesn't
    },
  });
}
