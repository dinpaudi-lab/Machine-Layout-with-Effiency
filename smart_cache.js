// ============ SMART DATE CACHE SYSTEM ============
// File: smart_cache.js

const DATE_CACHE_KEY = 'date_cache_v1'
const PREFETCH_DAYS = 3 // Prefetch 3 hari sebelum/sesudah

class DateCacheManager {
  constructor() {
    this.cache = this.loadCache()
    this.prefetchQueue = []
    this.isPrefetching = false
  }
  
  loadCache() {
    try {
      const saved = localStorage.getItem(DATE_CACHE_KEY)
      return saved ? JSON.parse(saved) : {}
    } catch (e) {
      console.warn('Cache load error:', e)
      return {}
    }
  }
  
  saveCache() {
    try {
      localStorage.setItem(DATE_CACHE_KEY, JSON.stringify(this.cache))
    } catch (e) {
      console.warn('Cache save error:', e)
    }
  }
  
  // Check if date is cached
  hasDate(date) {
    return this.cache[date] === true
  }
  
  // Mark date as cached
  markDateAsCached(date) {
    this.cache[date] = true
    this.saveCache()
  }
  
  // Get cached dates
  getCachedDates() {
    return Object.keys(this.cache).filter(date => this.cache[date] === true)
  }
  
  // Get dates to prefetch (around target date)
  getDatesToPrefetch(targetDate) {
    const dates = []
    const target = new Date(targetDate)
    
    // 3 hari sebelum
    for (let i = 1; i <= PREFETCH_DAYS; i++) {
      const prevDate = new Date(target)
      prevDate.setDate(prevDate.getDate() - i)
      const prevDateStr = prevDate.toISOString().split('T')[0]
      
      if (!this.hasDate(prevDateStr)) {
        dates.push(prevDateStr)
      }
    }
    
    // 3 hari sesudah
    for (let i = 1; i <= PREFETCH_DAYS; i++) {
      const nextDate = new Date(target)
      nextDate.setDate(nextDate.getDate() + i)
      const nextDateStr = nextDate.toISOString().split('T')[0]
      
      // Jangan prefetch tanggal di masa depan
      if (nextDate <= new Date() && !this.hasDate(nextDateStr)) {
        dates.push(nextDateStr)
      }
    }
    
    return dates
  }
  
  // Prefetch dates in background
  async prefetchDates(dates) {
    if (this.isPrefetching || dates.length === 0) return
    
    this.isPrefetching = true
    console.log(`🔄 Prefetching ${dates.length} dates:`, dates)
    
    for (const date of dates) {
      try {
        await window.lazyLoadDateData(date)
        this.markDateAsCached(date)
        console.log(`✅ Prefetched: ${date}`)
        
        // Delay sedikit untuk hindari overload
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (e) {
        console.warn(`⚠️ Prefetch failed for ${date}:`, e)
      }
    }
    
    this.isPrefetching = false
    console.log('✅ Prefetch complete')
  }
}

// Global cache manager
window.dateCache = new DateCacheManager()

console.log('✅ Smart cache system loaded')
