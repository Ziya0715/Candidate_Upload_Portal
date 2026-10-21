import 'server-only';
import { NextResponse } from 'next/server';

export function httpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  if (status >= 500) {
    error.publicMessage = message;
  }
  return error;
}

export function fail(error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const message =
    error?.publicMessage ||
    (status >= 500 ? 'Something went wrong. Please try again.' : error?.message || 'Request failed.');

  if (status >= 500) {
    console.error(error?.publicMessage || error);
  }

  return NextResponse.json(
    { error: message },
    {
      status,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}

export function jsonOk(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function readBody(request) {
  try {
    return await request.json();
  } catch {
    throw httpError('The request was empty or was not valid JSON.');
  }
}
