import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, ExternalLink, AlertTriangle, CheckCircle2, MessageCircle } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import fetchWithAuth from '../../services/fetchAuth';

type GatewayStatus = {
  ok: boolean;
  detail?: string;
  gateway_base_url?: string;
  status?: any;
};

type QrResponse =
  | { ok: true; mode: 'image'; data_url: string; gateway_base_url?: string }
  | { ok: true; mode: 'text'; qr_text: string; gateway_base_url?: string }
  | { ok: false; detail: string; gateway_base_url?: string };

type QrError = Extract<QrResponse, { ok: false }>;

function isQrError(value: QrResponse): value is QrError {
  return value.ok === false;
}

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function WhatsAppSenderPage() {
  const navigate = useNavigate();

  const [statusLoading, setStatusLoading] = useState(false);
  const [status, setStatus] = useState<GatewayStatus | null>(null);

  const [qrLoading, setQrLoading] = useState(false);
  const [qr, setQr] = useState<QrResponse | null>(null);

  const gatewayBaseUrl = useMemo(() => {
    return status?.gateway_base_url || qr?.gateway_base_url || '';
  }, [status, qr]);

  const loadStatus = useCallback(async () => {
    try {
      setStatusLoading(true);
      const resp = await fetchWithAuth('/api/accounts/settings/whatsapp/status/', { method: 'GET' });
      const text = await resp.text();
      const data = safeJsonParse(text) || { ok: false, detail: text };
      setStatus(data as GatewayStatus);
    } catch (e: any) {
      setStatus({ ok: false, detail: String(e?.message || e || 'Failed to load status') });
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const loadQr = useCallback(async () => {
    try {
      setQrLoading(true);
      const resp = await fetchWithAuth('/api/accounts/settings/whatsapp/qr/', { method: 'GET' });
      const text = await resp.text();
      const data = safeJsonParse(text) || { ok: false, detail: text };
      setQr(data as QrResponse);
    } catch (e: any) {
      setQr({ ok: false, detail: String(e?.message || e || 'Failed to load QR') });
    } finally {
      setQrLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadQr();
  }, [loadStatus, loadQr]);

  return (
    <DashboardLayout>
      <div className="px-4 sm:px-6 lg:px-8 pb-6 space-y-6">
        <div className="bg-white rounded-xl p-6 shadow-md">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">WhatsApp Sender Number</h1>
                <p className="text-gray-600 mt-1">
                  Pair the WhatsApp gateway by scanning QR. The paired number will be used to send WhatsApp OTP and notifications.
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate('/settings')}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-5 shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-gray-900">Gateway Status</div>
                <div className="text-sm text-gray-600 mt-1">Checks whether the WhatsApp gateway service is reachable.</div>
              </div>
              <button
                onClick={loadStatus}
                disabled={statusLoading}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${statusLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <div className="mt-4">
              {!gatewayBaseUrl && status ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm text-gray-700 font-medium mb-2">WhatsApp Gateway Not Configured</div>
                  <div className="text-xs text-gray-600 space-y-2">
                    <p>The WhatsApp gateway service is not set up. This feature requires:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>A separate Node.js service running whatsapp-web.js</li>
                      <li>Environment variable: <code className="bg-white px-1 py-0.5 rounded text-xs">SMS_BACKEND=whatsapp</code></li>
                      <li>Gateway URL configured in backend settings</li>
                    </ul>
                    <p className="mt-3 text-gray-500">
                      For development, OTP is logged to the Django console. For production, set up the WhatsApp gateway or use an SMS provider.
                    </p>
                  </div>
                </div>
              ) : status?.ok ? (
                <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-emerald-800">
                    Gateway reachable.
                    {gatewayBaseUrl ? (
                      <div className="text-xs text-emerald-700 mt-1">Service: {gatewayBaseUrl}</div>
                    ) : null}
                  </div>
                </div>
              ) : status ? (
                <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-700 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-900">
                    Gateway not reachable.
                    <div className="text-xs text-yellow-800 mt-1">{status.detail || 'Check Node service and URL configuration.'}</div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">Loading…</div>
              )}

              <div className="mt-4">
                <button
                  onClick={() => {
                    if (!gatewayBaseUrl) return;
                    try {
                      window.open(gatewayBaseUrl, '_blank', 'noopener,noreferrer');
                    } catch {
                      // ignore
                    }
                  }}
                  disabled={!gatewayBaseUrl}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Open Pairing Page
                  <ExternalLink className="w-4 h-4" />
                </button>

                {!gatewayBaseUrl ? (
                  <div className="mt-2 text-xs text-gray-500">
                    Gateway base URL is not available. Configure WhatsApp gateway in backend environment.
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-5 shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-gray-900">QR Code</div>
                <div className="text-sm text-gray-600 mt-1">Scan this QR from WhatsApp (Linked Devices) to pair.</div>
              </div>
              <button
                onClick={loadQr}
                disabled={qrLoading}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${qrLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <div className="mt-4">
              {qr?.ok && qr.mode === 'image' ? (
                <div className="border rounded-lg p-4 bg-gray-50 flex items-center justify-center">
                  <img
                    src={qr.data_url}
                    alt="WhatsApp QR"
                    className="w-64 h-64 object-contain bg-white rounded-md"
                  />
                </div>
              ) : qr?.ok && qr.mode === 'text' ? (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <div className="text-sm text-gray-700">
                    QR payload received, but image is not available from gateway.
                  </div>
                  <div className="mt-2 text-xs text-gray-600 break-all font-mono bg-white border rounded p-2">
                    {qr.qr_text}
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Tip: Open the pairing page to scan the QR visually.
                  </div>
                </div>
              ) : qr && isQrError(qr) && !status?.ok ? (
                <div className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
                  <div className="text-sm text-yellow-900">QR not available.</div>
                  <div className="text-xs text-yellow-800 mt-1">{qr.detail || 'Check gateway status and try refresh.'}</div>
                </div>
              ) : qr && isQrError(qr) && status?.ok ? (
                <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                  <div className="text-sm text-blue-900 font-medium">Gateway uses a web-based pairing interface.</div>
                  <div className="text-xs text-blue-800 mt-2">
                    Click <strong>"Open Pairing Page"</strong> below to scan the QR code from the gateway's web interface.
                  </div>
                  {gatewayBaseUrl ? (
                    <button
                      onClick={() => {
                        try {
                          window.open(gatewayBaseUrl, '_blank', 'noopener,noreferrer');
                        } catch {
                          // ignore
                        }
                      }}
                      className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium"
                    >
                      Open Pairing Page
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="text-sm text-gray-500">Loading…</div>
              )}

              <div className="mt-4 text-sm text-gray-600 leading-relaxed">
                <div className="font-semibold text-gray-800 mb-1">Steps</div>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Open WhatsApp on your phone.</li>
                  <li>Go to <span className="font-medium">Linked devices</span>.</li>
                  <li>Scan the QR shown {status?.ok ? 'on the gateway pairing page' : 'here (or via "Open Pairing Page")'}.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
