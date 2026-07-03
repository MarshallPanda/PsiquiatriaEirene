

// 👉 Reemplaza esto por la URL real que te da `firebase deploy` al final.
//    Formato esperado: https://us-central1-eirele-psicologica.cloudfunctions.net/chatCompletion
const CLOUD_FUNCTION_URL = 'https://us-central1-eirele-psicologica.cloudfunctions.net/chatCompletion';

// =========================================
// PROMPTS DE SISTEMA
// =========================================

const PROMPT_FINDER = `Eres el asistente virtual de la Clínica Psicológica EIRENE, especializada en salud mental. 
Tu misión es ayudar a los usuarios a identificar cuál de los psicólogos disponibles en la clínica se adapta mejor a sus necesidades específicas.

Cuando el usuario te describa su situación o lo que busca, debes:
1. Escuchar con calidez y sin juzgar
2. Hacer como MÁXIMO 1 pregunta de seguimiento si necesitas más información
3. Recomendar el especialista más adecuado de la lista disponible
4. Si ninguno encaja perfectamente → menciona el más cercano aclarando que podría ayudar aunque no sea el match ideal. Si no hay ningún candidato razonable, sugiere esperar a que la clínica incorpore nuevos especialistas.
5. Siempre invita a reservar una cita a través de la sección "Reserva" del sitio web.

Tono: profesional, cálido, breve. Máximo 4 oraciones por respuesta.
Idioma: SIEMPRE en español.`;

const PROMPT_SUPPORT = `Eres un asistente de apoyo emocional de la Clínica Psicológica EIRENE. 
Eres un bot de inteligencia artificial — NO eres psicólogo ni terapeuta real. Sé honesto sobre esto cuando sea relevante, sin exagerarlo en cada mensaje.

Puedes ayudar con:
• Escuchar sin juzgar a quien necesita expresarse
• Ofrecer estrategias generales de manejo emocional (respiración, escritura, reencuadre)
• Acompañar a quien tiene miedo o vergüenza de hablar con un profesional real
• Orientar suavemente hacia buscar ayuda profesional cuando el tema lo requiera

Reglas estrictas que NUNCA debes romper:
- No diagnostiques condiciones ni trastornos
- No recomiendes ni menciones medicamentos específicos
- Si alguien menciona hacerse daño, pensamientos suicidas o una crisis grave → di INMEDIATAMENTE que llame al 105 (emergencias Perú) o acuda a urgencias.
- Si te preguntan si sientes emociones: sé honesto — eres un bot y no sientes, pero puedes escuchar y acompañar.
- Cuando el problema necesite atención profesional, sugiere reservar una cita real en la clínica.

Tono: empático, cálido, sin tecnicismos, breve. Máximo 3-4 oraciones por respuesta.
Idioma: SIEMPRE en español.`;

// =========================================
// CLASE PRINCIPAL DEL CHATBOT
// =========================================

class ChatbotEIRENE {
    constructor({ id, systemPrompt, welcomeMsg }) {
        this.id               = id;
        this.baseSystemPrompt = systemPrompt;
        this.history          = [];
        this._retryTimer      = null; // Para cancelar el reintento si es necesario

        this.fabEl    = document.getElementById(`fab-${id}`);
        this.windowEl = document.getElementById(`chat-window-${id}`);
        this.msgsEl   = document.getElementById(`chat-msgs-${id}`);
        this.inputEl  = document.getElementById(`chat-input-${id}`);
        this.sendEl   = document.getElementById(`chat-send-${id}`);
        this.closeEl  = document.getElementById(`chat-close-${id}`);

        if (!this.fabEl || !this.windowEl) {
            console.warn(`[EIRENE Chatbot] Elementos no encontrados para id="${id}"`);
            return;
        }

        this._bindEvents();
        this._addMsg('bot', welcomeMsg);
    }

    // ── EVENTOS ──────────────────────────────────

    _bindEvents() {
        this.fabEl.addEventListener('click',   () => this._toggleWindow());
        this.closeEl.addEventListener('click', () => this._closeWindow());
        this.sendEl.addEventListener('click',  () => this._handleSend());
        this.inputEl.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._handleSend(); }
        });
    }

    // ── VENTANA ──────────────────────────────────

    _toggleWindow() {
        const isOpen = this.windowEl.classList.contains('chat-active');
        document.querySelectorAll('.chatbot-window').forEach(w => w.classList.remove('chat-active'));
        document.querySelectorAll('.chatbot-fab').forEach(f => f.classList.remove('fab-minimized'));
        if (!isOpen) {
            this.windowEl.classList.add('chat-active');
            this.fabEl.classList.add('fab-minimized');
            setTimeout(() => this.inputEl.focus(), 330);
        }
    }

    _closeWindow() {
        this.windowEl.classList.remove('chat-active');
        this.fabEl.classList.remove('fab-minimized');
    }

    // ── MENSAJES ─────────────────────────────────

    _addMsg(role, text) {
        const wrapper = document.createElement('div');
        wrapper.className = `chat-msg-wrapper ${role === 'bot' ? 'msg-bot-wrapper' : 'msg-user-wrapper'}`;
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${role === 'bot' ? 'bubble-bot' : 'bubble-user'}`;
        bubble.innerHTML = this._escapeHtml(text).replace(/\n/g, '<br>');
        wrapper.appendChild(bubble);
        this.msgsEl.appendChild(wrapper);
        this.msgsEl.scrollTop = this.msgsEl.scrollHeight;
        return wrapper; // retornamos para poder eliminar si es necesario
    }

    _escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    _showTyping() {
        this._hideTyping(); // evitar duplicados
        const div = document.createElement('div');
        div.className = 'chat-msg-wrapper msg-bot-wrapper';
        div.id = `typing-${this.id}`;
        div.innerHTML = `<div class="chat-bubble bubble-bot typing-bubble"><span></span><span></span><span></span></div>`;
        this.msgsEl.appendChild(div);
        this.msgsEl.scrollTop = this.msgsEl.scrollHeight;
    }

    _hideTyping() {
        document.getElementById(`typing-${this.id}`)?.remove();
    }

    _setLoading(active) {
        this.inputEl.disabled = active;
        this.sendEl.disabled  = active;
    }

    // ── CUENTA REGRESIVA Y REINTENTO (429) ───────

    /**
     * Muestra un mensaje con cuenta regresiva y reintenta automáticamente
     * al llegar a cero. Llama a _handleSend(true) para el reintento.
     */
    _startCountdownRetry(seconds = 10) {
        // Cancelar reintento previo si existiera
        if (this._retryTimer) clearInterval(this._retryTimer);

        const wrapper = document.createElement('div');
        wrapper.className = 'chat-msg-wrapper msg-bot-wrapper';
        wrapper.id = `retry-wrapper-${this.id}`;
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble bubble-bot';
        bubble.id = `retry-bubble-${this.id}`;
        wrapper.appendChild(bubble);
        this.msgsEl.appendChild(wrapper);
        this.msgsEl.scrollTop = this.msgsEl.scrollHeight;

        let t = seconds;
        const update = () => {
            const el = document.getElementById(`retry-bubble-${this.id}`);
            if (el) el.innerHTML = `⏳ Límite alcanzado. Reintentando en <strong>${t}s</strong>...`;
        };
        update();

        this._retryTimer = setInterval(() => {
            t--;
            if (t <= 0) {
                clearInterval(this._retryTimer);
                this._retryTimer = null;
                const el = document.getElementById(`retry-bubble-${this.id}`);
                if (el) el.textContent = '⏳ Reintentando...';
                this._handleSend(true); // reintento automático
            } else {
                update();
            }
        }, 1000);
    }

    _clearRetryMessage() {
        document.getElementById(`retry-wrapper-${this.id}`)?.remove();
        if (this._retryTimer) {
            clearInterval(this._retryTimer);
            this._retryTimer = null;
        }
    }

    // ── PROMPT DEL SISTEMA ───────────────────────

    _buildSystemPrompt() {
        if (this.id !== 'finder') return this.baseSystemPrompt;
        const data    = window.psicologosData || {};
        const entries = Object.entries(data);
        if (entries.length === 0) {
            return this.baseSystemPrompt + '\n\nNOTA: No hay psicólogos cargados aún. Sugiere al usuario que vuelva pronto.';
        }
        const lista = entries.map(([nombre, info]) =>
            `• ${nombre}: atiende ${info.dias.join(', ')} de ${info.inicio} a ${info.fin}`
        ).join('\n');
        return this.baseSystemPrompt + `\n\nPsicólogos disponibles en EIRENE:\n${lista}`;
    }

    // ── ENVÍO Y RESPUESTA ────────────────────────

    /**
     * @param {boolean} isRetry - true cuando es un reintento automático por 429
     */
    async _handleSend(isRetry = false) {
        const text = this.inputEl.value.trim();

        // ── Solo en envío inicial (no reintento) ──
        if (!isRetry) {
            if (!text || this.inputEl.disabled) return;

            this.inputEl.value = '';
            this._addMsg('user', text);
            this.history.push({ role: 'user', content: text });
        }

        this._setLoading(true);
        this._showTyping();

        try {
            const response = await fetch(CLOUD_FUNCTION_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    systemPrompt: this._buildSystemPrompt(),
                    messages: this.history
                })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(`HTTP_${response.status}::${data.error || ''}`);
            }

            const reply = data.reply?.trim();
            if (!reply) throw new Error('EMPTY_RESPONSE');

            // Éxito: limpiar reintento y mostrar respuesta
            this._clearRetryMessage();
            this.history.push({ role: 'assistant', content: reply });
            this._hideTyping();
            this._addMsg('bot', reply);

        } catch (err) {
            console.error(`[Chatbot ${this.id}]`, err);
            this._hideTyping();

            const msg = (err.message || '').toLowerCase();
            const is429 = msg.includes('http_429') || msg.includes('rate_limit') || msg.includes('rate limit');

            // ── Rate limit: reintento automático ──────────────────
            // Solo en el primer intento. Si el reintento también falla → mostrar error.
            if (is429 && !isRetry) {
                this._setLoading(false);
                this.inputEl.focus();
                this._startCountdownRetry(10);
                return; // finally correrá igualmente pero _setLoading ya se llamó
            }

            // ── Otros errores o segundo fallo 429 ─────────────────
            let msgError;

            if (err instanceof TypeError || msg.includes('failed to fetch') || msg.includes('load failed') || msg.includes('network')) {
                msgError =
                    '⚠️ Error de red.\n\n' +
                    '¿Abriste el sitio haciendo doble clic en el archivo HTML?\n' +
                    'Los chatbots necesitan un servidor web:\n\n' +
                    '• VS Code → clic derecho en index.html → "Open with Live Server"\n' +
                    '• Terminal → npx serve .';
            } else if (msg.includes('http_401') || msg.includes('http_403')) {
                msgError = '⚠️ Error de configuración del servidor. Contacta al administrador del sitio.';
            } else if (msg.includes('http_404')) {
                msgError = '⚠️ No se encontró el servicio de chat. Verifica que CLOUD_FUNCTION_URL esté bien configurada.';
            } else if (is429) {
                // Segundo 429 después del reintento automático
                msgError = '⏳ El límite de solicitudes sigue activo. Espera 1-2 minutos e intenta de nuevo.';
            } else if (msg.includes('http_5')) {
                msgError = '⚙️ OpenAI tiene problemas temporales en sus servidores. Intenta en unos minutos.';
            } else if (msg === 'empty_response') {
                msgError = 'No recibí respuesta. Por favor intenta de nuevo.';
            } else {
                msgError = 'Ocurrió un error inesperado. 🙏 Intenta de nuevo en un momento.';
            }

            this._addMsg('bot', msgError);

        } finally {
            this._setLoading(false);
            this.inputEl.focus();
        }
    }
}

// =========================================
// INICIALIZACIÓN
// =========================================

document.addEventListener('DOMContentLoaded', () => {

    // Advertencias de configuración en consola del navegador
    if (location.protocol === 'file:') {
        console.warn(
            '%c[EIRENE Chatbots] ⚠️ Abierto como archivo local (file://)',
            'color: red; font-weight: bold',
            '\n→ Los chatbots no funcionarán desde file://\n→ Usa Live Server en VS Code o ejecuta: npx serve .'
        );
    }

    // ── Bot 1: Encontrar Psicólogo ──
    new ChatbotEIRENE({
        id:           'finder',
        systemPrompt: PROMPT_FINDER,
        welcomeMsg:   'Hola 👋 Soy el asistente de EIRENE. Cuéntame qué tipo de apoyo psicológico estás buscando y te ayudaré a encontrar al especialista más adecuado para ti.'
    });

    // ── Bot 2: Apoyo Emocional ──
    new ChatbotEIRENE({
        id:           'support',
        systemPrompt: PROMPT_SUPPORT,
        welcomeMsg:   'Hola 💙 Soy un asistente de apoyo emocional. Estoy aquí para escucharte.\n\n¿Cómo te sientes hoy? Puedes contarme lo que quieras.\n(Soy un bot, no un psicólogo real, pero puedo acompañarte.)'
    });

});