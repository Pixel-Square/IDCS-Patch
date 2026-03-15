import React, { createContext, useContext, useMemo, useState } from 'react'

const SERIAL_FILTERS = [
  { usbVendorId: 0x1a86, usbProductId: 0x7523 },
  { usbVendorId: 0x1a86, usbProductId: 0x5523 },
  { usbVendorId: 0x1a86, usbProductId: 0x55d4 },
  { usbVendorId: 0x10c4, usbProductId: 0xea60 },
  { usbVendorId: 0x0403, usbProductId: 0x6001 },
  { usbVendorId: 0x0403, usbProductId: 0x6015 },
  { usbVendorId: 0x2341, usbProductId: 0x0043 },
  { usbVendorId: 0x2341, usbProductId: 0x0001 },
]

const USB_NAMES: Record<string, string> = {
  '1a86:7523': 'CH340 USB-Serial (NodeMCU)',
  '1a86:5523': 'CH341 USB-Serial (NodeMCU)',
  '1a86:55d4': 'CH9102 USB-Serial (NodeMCU)',
  '10c4:ea60': 'CP210x USB to UART',
  '0403:6001': 'FT232RL USB-Serial',
  '0403:6015': 'FT231XS USB-Serial',
  '2341:0043': 'Arduino Uno',
  '2341:0001': 'Arduino Uno',
}

function getDeviceName(port: any): string {
  try {
    const info = port.getInfo?.()
    if (!info?.usbVendorId) return 'USB Serial Device'
    const vid = (info.usbVendorId as number).toString(16).padStart(4, '0')
    const pid = ((info.usbProductId ?? 0) as number).toString(16).padStart(4, '0')
    return USB_NAMES[`${vid}:${pid}`] ?? `USB Device (${vid.toUpperCase()}:${pid.toUpperCase()})`
  } catch {
    return 'USB Serial Device'
  }
}

type ScannerCtx = {
  serialSupported: boolean
  port: any | null
  deviceName: string
  selectPort: () => Promise<void>
}

const Ctx = createContext<ScannerCtx | null>(null)

export function ScannerProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [port, setPort] = useState<any | null>(null)
  const [deviceName, setDeviceName] = useState('')
  const serialSupported = typeof (navigator as any).serial !== 'undefined'

  const selectPort = async () => {
    if (!serialSupported) return
    let p: any
    try {
      try {
        p = await (navigator as any).serial.requestPort({ filters: SERIAL_FILTERS })
      } catch (err: any) {
        if (err?.name === 'NotAllowedError') return
        p = await (navigator as any).serial.requestPort()
      }
      setPort(p)
      setDeviceName(getDeviceName(p))
    } catch {
      // ignore; caller shows UI error
    }
  }

  const value = useMemo(() => ({ serialSupported, port, deviceName, selectPort }), [serialSupported, port, deviceName])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useScanner(): ScannerCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('ScannerProvider missing')
  return v
}
