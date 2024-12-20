import { EventEmitter } from 'events'
import { usb, findByIds, getDeviceList } from 'usb'


const selectors: any = {
  isScaleIdle: dataArr => dataArr[1] === 2,
  isScaleWeighting: dataArr => dataArr[1] === 3,
  isScaleReady: dataArr => dataArr[1] === 4,
  isScaleOverweight: dataArr => dataArr[1] === 6,
  isScaleSystemOunces: dataArr => dataArr[2] === 12,
  isScaleSystemGrams: dataArr => dataArr[2] === 3,
}


const NODE_DYMO_VENDOR_ID: number = 2338
export const NODE_DYMO_SYSTEM: any = {
  GRAMS: 'grams',
  OUNCES: 'ounces',
}

export class NodeDymo {
  protected isReady: boolean = false
  protected weight: any = {
    value: 0,
    isOverweight: false,
    system: NODE_DYMO_SYSTEM.GRAMS,
  }
  protected emitter: EventEmitter = new EventEmitter()

  init(productId: string = null) {
    this.listenForScaleConnectionEvents()
    this.findScale(productId).then(foundDevice => {
      return this.connectScale(foundDevice)
    }).then(connectedDevice => {
      return this.listenToScaleUpdates(connectedDevice)
    }).catch(err => {
      this.isReady = false
      this.emitter.emit('end', err.message)
    })
  }

  on(event: string, callback: Function|any): void {
    this.emitter.on(event, callback)
  }

  getWeight() {
    return this.weight
  }

  get isScaleReady() {
    return this.isReady
  }

  get isScaleOverweight() {
    return this.weight.isOverweight
  }

  protected listenForScaleConnectionEvents() {
    usb.on('attach', device => {
      if (device.deviceDescriptor.idVendor === NODE_DYMO_VENDOR_ID) {
        this.init(String(device.deviceDescriptor.idProduct))
        this.emitter.emit('online')
      }
    })
    usb.on('detach', device => {
      if (device.deviceDescriptor.idVendor === NODE_DYMO_VENDOR_ID) {
        this.isReady = false
        this.emitter.emit('offline')
      }
    })
  }

  protected findScale(productId: string = null): Promise<any> {
    return new Promise((resolve, reject) => {
      let allUsbDevices = []
      const dymoUsbDevices = []
      if (!!productId && findByIds(NODE_DYMO_VENDOR_ID, Number(productId))) {
        return resolve(findByIds(NODE_DYMO_VENDOR_ID, Number(productId)))
      } else {
        allUsbDevices = getDeviceList()
        for (let i = 0; i < allUsbDevices.length; i++) {
          if (allUsbDevices[i].deviceDescriptor.idVendor === NODE_DYMO_VENDOR_ID) {
            dymoUsbDevices.push(allUsbDevices[i])
          }
        }
        if (dymoUsbDevices.length > 1) {
          return reject('ERROR: Specify productId! (more than one Dymo scale)')
        } else if (dymoUsbDevices.length === 0) {
          return reject('ERROR: No Dymo scales!')
        } else {
          return resolve(dymoUsbDevices[0])
        }
      }
    })
  }

  protected connectScale(device): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        device.open()
        device.reset(() => {
          if (device.interface(0).isKernelDriverActive()) {
            device.interface(0).detachKernelDriver()
          }
          device.interface(0).claim()
          return resolve(device)
        })
      } catch (e) {
        return reject(`ERROR: ${e.message}`)
      }
    })
  }

  protected listenToScaleUpdates(device) {
    device.interface(0).endpoint(130).startPoll(3, 6)
    this.isReady = true

    device.interface(0).endpoint(130).on('error', data => {
      this.isReady = false
      this.emitter.emit('end', data)
    });

    device.interface(0).endpoint(130).on('end', data => {
      this.isReady = false
      this.emitter.emit('end', data)
      device.interface(0).endpoint(130).stopPoll()
    });

    device.interface(0).endpoint(130).on('data', data => {
      const buffer = data.toJSON()
      const dataArr = Object.keys(buffer).includes('data') ? buffer.data : buffer
      let isOverweight: boolean = false
      let value: number = 0
      let system: string = NODE_DYMO_SYSTEM.GRAMS

      if (selectors.isScaleIdle(dataArr)) {
        isOverweight = false
        value = 0
      }
      if (selectors.isScaleSystemOunces(dataArr)) {
        system = NODE_DYMO_SYSTEM.OUNCES
      }
      if (selectors.isScaleSystemGrams(dataArr)) {
        system = NODE_DYMO_SYSTEM.GRAMS
      }
      if (selectors.isScaleReady(dataArr) && system === NODE_DYMO_SYSTEM.OUNCES) {
        isOverweight = false
        value = Math.round(((dataArr[4] + (dataArr[5] * 256)) * 0.1) * 100)
      }
      if (selectors.isScaleReady(dataArr) && system === NODE_DYMO_SYSTEM.GRAMS) {
        isOverweight = false
        value = Math.round((dataArr[4] + dataArr[5] * 256) * 100)
      }
      if (selectors.isScaleOverweight(dataArr)) {
        isOverweight = true
        value = 0
      }

      if (this.weight.value !== value) {
        this.weight.value = value
        this.weight.system = system
        this.emitter.emit('weight-change', { value: value, system: system })
        this.emitter.emit('weight', this.weight)
      }
      if (this.weight.isOverweight !== isOverweight) {
        this.weight.isOverweight = isOverweight
        this.emitter.emit('overweight-change', isOverweight)
        this.emitter.emit('weight', this.weight)
      }
    })
  }
}

