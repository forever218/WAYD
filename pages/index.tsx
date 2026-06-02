import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { invoke } from '@tauri-apps/api/tauri'
import { readBinaryFile } from '@tauri-apps/api/fs'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Model {
  id: string
  object: string
}

export default function Home() {
  const [apiEndpoint, setApiEndpoint] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [settingsVisible, setSettingsVisible] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [isBubbleMode, setIsBubbleMode] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [tauriApi, setTauriApi] = useState<any>(null)
  const [screenshotInterval, setScreenshotInterval] = useState<number>(30)
  const [screenshotIntervalInput, setScreenshotIntervalInput] = useState<string>('30')
  const [prompt, setPrompt] = useState('现在你是一个在用户电脑里的AI助手，这是用户正在做的内容，请你给一个20字左右的建议或者是俏皮的调侃。')
  const [selectedModel, setSelectedModel] = useState('gpt-3.5-turbo')
  const [availableModels, setAvailableModels] = useState<string[]>(['gpt-3.5-turbo', 'gpt-4'])
  const [isAutoCapture, setIsAutoCapture] = useState(false)
  const [cachePath, setCachePath] = useState('')
  const [theme, setTheme] = useState<'neumorphic' | 'cyberpunk'>('neumorphic')

  // 气泡模式相关状态
  const [bubbleMessage, setBubbleMessage] = useState('')
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined') {
      import('@tauri-apps/api/window').then(mod => {
        setTauriApi({ appWindow: mod.appWindow })
      })
    }
  }, [])

  useEffect(() => {
    const savedEndpoint = localStorage.getItem('apiEndpoint')
    const savedApiKey = localStorage.getItem('apiKey')
    const savedScreenshotInterval = localStorage.getItem('screenshotInterval')
    const savedPrompt = localStorage.getItem('prompt')
    const savedSelectedModel = localStorage.getItem('selectedModel')
    const savedIsAutoCapture = localStorage.getItem('isAutoCapture')
    const savedCachePath = localStorage.getItem('cachePath')
    const savedTheme = localStorage.getItem('theme')
    
    if (savedEndpoint) setApiEndpoint(savedEndpoint)
    if (savedApiKey) setApiKey(savedApiKey)
    if (savedScreenshotInterval) {
      const interval = parseInt(savedScreenshotInterval)
      setScreenshotInterval(interval)
      setScreenshotIntervalInput(interval.toString())
    }
    if (savedPrompt) setPrompt(savedPrompt)
    if (savedSelectedModel) setSelectedModel(savedSelectedModel)
    if (savedIsAutoCapture) setIsAutoCapture(savedIsAutoCapture === 'true')
    if (savedCachePath) setCachePath(savedCachePath)
    if (savedTheme) setTheme(savedTheme as 'neumorphic' | 'cyberpunk')
  }, [])

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages])

  // 监听messages变化，如果在气泡模式下且有新的assistant消息，显示它
  useEffect(() => {
    if (isBubbleMode && messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.role === 'assistant') {
        setBubbleMessage(lastMessage.content)
      }
    }
  }, [messages, isBubbleMode])

  // 打字机效果
  useEffect(() => {
    if (!bubbleMessage || !isBubbleMode) {
      setDisplayedText('')
      return
    }

    setIsTyping(true)
    setDisplayedText('')
    
    let currentIndex = 0
    const typingSpeed = 50 // 每个字符显示间隔（毫秒）

    const typeNextChar = () => {
      if (currentIndex < bubbleMessage.length) {
        setDisplayedText(bubbleMessage.slice(0, currentIndex + 1))
        currentIndex++
        typingTimerRef.current = setTimeout(typeNextChar, typingSpeed)
      } else {
        setIsTyping(false)
        // 打字完成后，停留5秒后隐藏
        hideTimerRef.current = setTimeout(() => {
          setBubbleMessage('')
          setDisplayedText('')
        }, 5000)
      }
    }

    typeNextChar()

    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current)
      }
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
      }
    }
  }, [bubbleMessage, isBubbleMode])

  // 动态调整气泡宽度
  useEffect(() => {
    if (!isBubbleMode || !mounted || !tauriApi) return

    const adjustBubbleSize = async () => {
      const { LogicalSize } = await import('@tauri-apps/api/window')
      
      if (displayedText) {
        // 根据文字长度计算宽度，最小200，最大600
        const textLength = displayedText.length
        const width = Math.min(Math.max(200, textLength * 12 + 100), 600)
        await tauriApi.appWindow.setSize(new LogicalSize(width, 50))
      } else {
        // 没有消息时回缩到最小
        await tauriApi.appWindow.setSize(new LogicalSize(150, 50))
      }
    }

    adjustBubbleSize()
  }, [displayedText, isBubbleMode, mounted, tauriApi])

  const handleSaveSettings = () => {
    localStorage.setItem('apiEndpoint', apiEndpoint)
    localStorage.setItem('apiKey', apiKey)
    localStorage.setItem('screenshotInterval', screenshotInterval.toString())
    localStorage.setItem('prompt', prompt)
    localStorage.setItem('selectedModel', selectedModel)
    localStorage.setItem('isAutoCapture', isAutoCapture.toString())
    localStorage.setItem('cachePath', cachePath)
    localStorage.setItem('theme', theme)
    setSettingsVisible(false)
    
    if (isAutoCapture) {
      startAutoCapture()
    } else {
      stopAutoCapture()
    }
  }

  const fetchModels = async () => {
    if (!apiEndpoint || !apiKey) return
    
    try {
      let endpoint = apiEndpoint
      const isDeepSeek = apiEndpoint.includes('deepseek.com')
      const isZhipu = apiEndpoint.includes('bigmodel.cn')
      
      if (isZhipu) {
        if (!endpoint.endsWith('/models')) {
          endpoint = endpoint.endsWith('/') ?
            `${endpoint}models` :
            `${endpoint}/models`
        }
      } else if (isDeepSeek && !endpoint.endsWith('/models')) {
        endpoint = endpoint.endsWith('/') ?
          `${endpoint}models` :
          `${endpoint}/models`
      } else if (!endpoint.endsWith('/v1/models')) {
        endpoint = endpoint.endsWith('/') ?
          `${endpoint}v1/models` :
          `${endpoint}/v1/models`
      }
      
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      let models = data.data.map((model: Model) => model.id)
      
      if (apiEndpoint.includes('bigmodel.cn')) {
        const visionModels = ['GLM-4.6V-Flash', 'glm-4v', 'glm-4v-plus', 'glm-4v-flash']
        visionModels.forEach(visionModel => {
          if (!models.includes(visionModel)) {
            models.push(visionModel)
          }
        })
      }
      
      setAvailableModels(models)
      
      if (!models.includes(selectedModel) && models.length > 0) {
        setSelectedModel(models[0])
      }
    } catch (error) {
      console.error('Error fetching models:', error)
    }
  }

  const isCapturing = useRef(false)

  const captureAndAnalyze = async () => {
    if (!apiEndpoint || !apiKey) return
    if (isCapturing.current) {
      console.log('上一次截图和分析还未完成，跳过本次')
      return
    }
    isCapturing.current = true
    
    try {
      const screenshotPath = await invoke<string>('capture_screen', { path: cachePath || undefined })
      
      try {
        const screenshotData = await readBinaryFile(screenshotPath)
        const base64Image = btoa(
          new Uint8Array(screenshotData).reduce((data, byte) => data + String.fromCharCode(byte), '')
        )
        
        let endpoint = apiEndpoint
        const isDeepSeek = apiEndpoint.includes('deepseek.com')
        const isZhipu = apiEndpoint.includes('bigmodel.cn')
        
        if (isZhipu) {
          if (!endpoint.endsWith('/chat/completions')) {
            endpoint = endpoint.endsWith('/') ?
              `${endpoint}chat/completions` :
              `${endpoint}/chat/completions`
          }
        } else if (isDeepSeek && !endpoint.endsWith('/chat/completions')) {
          endpoint = endpoint.endsWith('/') ?
            `${endpoint}chat/completions` :
            `${endpoint}/chat/completions`
        } else if (!endpoint.endsWith('/v1/chat/completions')) {
          endpoint = endpoint.endsWith('/') ?
            `${endpoint}v1/chat/completions` :
            `${endpoint}/v1/chat/completions`
        }
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: prompt,
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:image/png;base64,${base64Image}`,
                    },
                  },
                ],
              },
            ],
          }),
        })
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        const aiMessage = data.choices[0].message.content
        
        const assistantMessage: Message = {
          role: 'assistant',
          content: aiMessage,
        }
        setMessages(prev => [...prev, assistantMessage])

      } finally {
        await invoke('delete_file', { path: screenshotPath })
      }
    } catch (error) {
      console.error('Error capturing and analyzing:', error)
    } finally {
      isCapturing.current = false
    }
  }

  const captureTimer = useRef<NodeJS.Timeout | null>(null)
  
  const startAutoCapture = () => {
    stopAutoCapture()
    const scheduleNextCapture = async () => {
      await captureAndAnalyze()
      if (isAutoCapture) {
        captureTimer.current = setTimeout(scheduleNextCapture, screenshotInterval * 1000)
      }
    }
    if (!isCapturing.current) {
      scheduleNextCapture()
    } else {
      console.log('等待当前截图完成...')
    }
  }
  
  const stopAutoCapture = () => {
    if (captureTimer.current) {
      clearTimeout(captureTimer.current)
      captureTimer.current = null
    }
  }
  
  useEffect(() => {
    if (isAutoCapture) {
      startAutoCapture()
    } else {
      stopAutoCapture()
    }
    
    return () => stopAutoCapture()
  }, [isAutoCapture])

  // 根据主题设置data-theme属性
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme)
    }
  }, [theme])

  const handleSendMessage = async () => {
    if (!input.trim() || !apiEndpoint || !apiKey) return

    const newMessage: Message = { role: 'user', content: input }
    setMessages([...messages, newMessage])
    setInput('')
    setLoading(true)

    try {
      const isDeepSeek = apiEndpoint.includes('deepseek.com')
      const model = isDeepSeek ? 'deepseek-chat' : 'gpt-3.5-turbo'

      let endpoint = apiEndpoint
      if (isDeepSeek && !endpoint.endsWith('/chat/completions')) {
        endpoint = endpoint.endsWith('/') ? 
          `${endpoint}chat/completions` : 
          `${endpoint}/chat/completions`
      } else if (!isDeepSeek && !endpoint.endsWith('/v1/chat/completions')) {
        endpoint = endpoint.endsWith('/') ? 
          `${endpoint}v1/chat/completions` : 
          `${endpoint}/v1/chat/completions`
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [...messages, newMessage],
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.choices[0].message.content,
      }
      setMessages([...messages, newMessage, assistantMessage])
    } catch (error) {
      console.error('Error calling API:', error)
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
      setMessages([...messages, newMessage, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!mounted || !tauriApi) return
    console.log('Minimize button clicked')
    try {
      await tauriApi.appWindow.minimize()
      setIsMinimized(true)
    } catch (error) {
      console.error('Error minimizing window:', error)
    }
  }

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!mounted || !tauriApi) return
    console.log('Close button clicked')
    try {
      await tauriApi.appWindow.close()
    } catch (error) {
      console.error('Error closing window:', error)
    }
  }

  const handleMouseDown = async (e: React.MouseEvent) => {
    if (!mounted || !tauriApi) return
    console.log('Mouse down on title bar')
    try {
      await tauriApi.appWindow.startDragging()
    } catch (error) {
      console.error('Error starting drag:', error)
    }
  }

  const handleBubbleMode = async () => {
    if (!mounted || !tauriApi) return
    
    const { LogicalSize } = await import('@tauri-apps/api/window')
    
    if (isBubbleMode) {
      // 还原窗口
      await tauriApi.appWindow.setSize(new LogicalSize(400, 600))
      await tauriApi.appWindow.setAlwaysOnTop(false)
      setIsBubbleMode(false)
      setBubbleMessage('')
      setDisplayedText('')
    } else {
      // 气泡化窗口
      await tauriApi.appWindow.setSize(new LogicalSize(150, 50))
      await tauriApi.appWindow.setAlwaysOnTop(true)
      setIsBubbleMode(true)
    }
  }

  if (!mounted) {
    return null
  }

  return (
    <div 
      className={`${theme === 'cyberpunk' ? 'bg-gray-900' : 'bg-gray-200'} rounded-3xl overflow-hidden ${isBubbleMode ? 'w-full h-full' : 'min-h-screen'}`}
    >
      {/* 自定义标题栏 */}
      <div 
        className={`${theme === 'cyberpunk' ? 'bg-gray-900 text-cyan-400' : 'bg-gray-200 text-gray-800'} flex justify-between items-center select-none ${theme === 'cyberpunk' ? 'shadow-[0_0_10px_rgba(0,255,255,0.3)]' : 'shadow-inner'} ${isBubbleMode ? 'p-1 cursor-move' : 'p-3'}`}
        onMouseDown={isBubbleMode ? handleMouseDown : undefined}
      >
        <div 
          className={`flex items-center ${isBubbleMode ? 'space-x-1' : 'space-x-2'} ${!isBubbleMode ? 'cursor-move' : ''} ${isBubbleMode ? 'flex-shrink-0' : 'flex-grow'}`}
          onMouseDown={!isBubbleMode ? handleMouseDown : undefined}
        >
          <div className={`${isBubbleMode ? 'w-6 h-6' : 'w-8 h-8'} ${theme === 'cyberpunk' ? 'bg-gray-800 rounded-full shadow-[0_0_5px_rgba(0,255,255,0.5)]' : 'bg-gray-300 rounded-full shadow-md'} flex items-center justify-center flex-shrink-0`}>
            <span className={isBubbleMode ? 'text-sm' : 'text-lg'}>👀</span>
          </div>
          {!isBubbleMode && (
            <span className="font-bold text-sm"></span>
          )}
        </div>
        
        {/* 气泡模式消息显示区域 */}
        {isBubbleMode && displayedText && (
          <div 
            className="flex-grow px-2 overflow-hidden"
          >
            <div className={`text-xs ${theme === 'cyberpunk' ? 'text-cyan-400' : 'text-gray-700'} whitespace-nowrap overflow-hidden text-ellipsis`}>
              {displayedText}
              {isTyping && <span className={`inline-block w-1 h-3 ${theme === 'cyberpunk' ? 'bg-cyan-400' : 'bg-gray-700'} ml-1 animate-pulse`}></span>}
            </div>
          </div>
        )}
        
        <div className="flex items-center space-x-2 flex-shrink-0">
          {isBubbleMode ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleBubbleMode()
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className={`w-6 h-6 ${theme === 'cyberpunk' ? 'bg-gray-800 rounded-full shadow-[0_0_5px_rgba(0,255,255,0.5)] hover:shadow-[0_0_10px_rgba(0,255,255,0.7)]' : 'bg-gray-300 rounded-full shadow-md hover:shadow-lg'} flex items-center justify-center transition-all text-xs`}
              title="还原"
            >
              ↩
            </button>
          ) : (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSettingsVisible(true)
                }}
                className={`w-8 h-8 ${theme === 'cyberpunk' ? 'bg-gray-800 rounded-full shadow-[0_0_5px_rgba(0,255,255,0.5)] hover:shadow-[0_0_10px_rgba(0,255,255,0.7)]' : 'bg-gray-300 rounded-full shadow-md hover:shadow-lg'} flex items-center justify-center transition-all`}
                title="设置"
              >
                ⚙️
              </button>
              <button
                onClick={handleBubbleMode}
                className={`w-8 h-8 ${theme === 'cyberpunk' ? 'bg-gray-800 rounded-full shadow-[0_0_5px_rgba(0,255,255,0.5)] hover:shadow-[0_0_10px_rgba(0,255,255,0.7)]' : 'bg-gray-300 rounded-full shadow-md hover:shadow-lg'} flex items-center justify-center transition-all`}
                title="气泡化"
              >
                💬
              </button>
              <button
                onClick={handleMinimize}
                className={`w-8 h-8 ${theme === 'cyberpunk' ? 'bg-gray-800 rounded-full shadow-[0_0_5px_rgba(0,255,255,0.5)] hover:shadow-[0_0_10px_rgba(0,255,255,0.7)]' : 'bg-gray-300 rounded-full shadow-md hover:shadow-lg'} flex items-center justify-center transition-all`}
                title="最小化"
              >
                −
              </button>
              <button
                onClick={handleClose}
                className={`w-8 h-8 ${theme === 'cyberpunk' ? 'bg-gray-800 rounded-full shadow-[0_0_5px_rgba(0,255,255,0.5)] hover:shadow-[0_0_10px_rgba(0,255,255,0.7)]' : 'bg-gray-300 rounded-full shadow-md hover:shadow-lg'} flex items-center justify-center transition-all`}
                title="关闭"
              >
                ×
              </button>
            </>
          )}
        </div>
      </div>

      {/* 设置面板 */}
      {!isBubbleMode && settingsVisible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 rounded-3xl">
          <div className="bg-gray-200 rounded-2xl p-6 w-96 shadow-xl shadow-inner max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 text-gray-800">API 设置</h2>
            <div className="mb-4">
              <label className="block mb-2 text-sm text-gray-700">API 端点</label>
              <input
                type="text"
                value={apiEndpoint}
                onChange={(e) => setApiEndpoint(e.target.value)}
                className="w-full bg-gray-100 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-gray-500 shadow-inner"
                placeholder="https://api.openai.com/v1/chat/completions"
              />
            </div>
            <div className="mb-4">
              <label className="block mb-2 text-sm text-gray-700">API 密钥</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-gray-100 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-gray-500 shadow-inner"
                placeholder="sk-..."
              />
            </div>
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-gray-700">模型</label>
                <button
                  onClick={fetchModels}
                  className="text-xs px-2 py-1 bg-gray-300 rounded hover:bg-gray-400 transition-colors"
                >
                  刷新模型列表
                </button>
              </div>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-gray-100 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-gray-500 shadow-inner"
              >
                {availableModels.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block mb-2 text-sm text-gray-700">提示词</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full bg-gray-100 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-gray-500 shadow-inner resize-none"
                rows={3}
              />
            </div>
            <div className="mb-4">
              <label className="block mb-2 text-sm text-gray-700">截图间隔（秒）</label>
              <input
                type="number"
                value={screenshotIntervalInput}
                onChange={(e) => {
                  setScreenshotIntervalInput(e.target.value);
                }}
                onBlur={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setScreenshotIntervalInput('30');
                    setScreenshotInterval(30);
                  } else {
                    const num = parseInt(value);
                    if (isNaN(num) || num < 5) {
                      setScreenshotIntervalInput('5');
                      setScreenshotInterval(5);
                    } else if (num > 3600) {
                      setScreenshotIntervalInput('3600');
                      setScreenshotInterval(3600);
                    } else {
                      setScreenshotIntervalInput(num.toString());
                      setScreenshotInterval(num);
                    }
                  }
                }}
                min="5"
                max="3600"
                className="w-full bg-gray-100 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-gray-500 shadow-inner [appearance-none] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="mb-4 flex items-center">
              <input
                type="checkbox"
                id="autoCapture"
                checked={isAutoCapture}
                onChange={(e) => setIsAutoCapture(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="autoCapture" className="text-sm text-gray-700">启用自动截图</label>
            </div>
            <div className="mb-4">
              <label className="block mb-2 text-sm text-gray-700">图片缓存路径</label>
              <div className="flex">
                <input
                  type="text"
                  value={cachePath}
                  onChange={(e) => setCachePath(e.target.value)}
                  className="flex-grow bg-gray-100 rounded-l-lg p-2 focus:outline-none focus:ring-2 focus:ring-gray-500 shadow-inner"
                  placeholder="留空则使用桌面路径"
                />
                <button
                  onClick={async () => {
                    try {
                      const { open } = await import('@tauri-apps/api/dialog')
                      const selected = await open({
                        directory: true,
                        multiple: false,
                        title: '选择缓存路径'
                      })
                      if (selected && typeof selected === 'string') {
                        setCachePath(selected)
                      }
                    } catch (error) {
                      console.error('Error opening directory dialog:', error)
                    }
                  }}
                  className="px-4 bg-gray-300 rounded-r-lg hover:bg-gray-400 transition-colors shadow-md"
                >
                  浏览
                </button>
              </div>
            </div>
            <div className="mb-4">
              <label className="block mb-2 text-sm text-gray-700">主题风格</label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="theme"
                    value="neumorphic"
                    checked={theme === 'neumorphic'}
                    onChange={(e) => setTheme(e.target.value as 'neumorphic' | 'cyberpunk')}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">拟态风</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="theme"
                    value="cyberpunk"
                    checked={theme === 'cyberpunk'}
                    onChange={(e) => setTheme(e.target.value as 'neumorphic' | 'cyberpunk')}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">赛博朋克风</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setSettingsVisible(false)}
                className="mr-2 px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400 transition-colors shadow-md"
              >
                取消
              </button>
              <button
                onClick={handleSaveSettings}
                className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors shadow-md"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 聊天区域 */}
      {!isBubbleMode && (
        <div className="chat-container p-4 flex-1 overflow-y-auto rounded-b-none" ref={chatContainerRef}>
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-10">
            <div className="text-6xl mb-4">💬</div>
            <p className="text-sm">请先设置 API 端点和密钥，然后开始对话</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`message mb-4 ${
                message.role === 'user' ? 'user-message' : 'assistant-message'
              }`}
            >
              <div className="font-bold mb-1 text-sm">
                {message.role === 'user' ? '👤 用户' : '🤖 AI 助手'}
              </div>
              <div className={`p-3 rounded-xl shadow-md ${
                message.role === 'user' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-800'
              }`}>
                <ReactMarkdown className="text-sm">{message.content}</ReactMarkdown>
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="message assistant-message mb-4">
            <div className="font-bold mb-1 text-sm">🤖 AI 助手</div>
            <div className="p-3 rounded-xl shadow-md bg-gray-200 text-gray-800">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* 输入区域 */}
      {!isBubbleMode && (
        <div className="input-area p-3">
          <div className="flex">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-grow bg-gray-100 rounded-l-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-gray-500 text-sm shadow-inner"
              placeholder="输入消息..."
              rows={2}
            />
            <button
              onClick={handleSendMessage}
              disabled={!input.trim() || loading || !apiEndpoint || !apiKey}
              className="px-4 bg-gray-800 text-white rounded-r-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all shadow-md"
            >
              发送
            </button>
          </div>
        </div>
      )}
    </div>
  )
}