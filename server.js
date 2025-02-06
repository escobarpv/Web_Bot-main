require('dotenv').config();

// Importamos los módulos necesarios.
const http = require('http');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai').default;

// Instancia de OpenAI con la API key.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

let activeThreadId = null;

// Creamos el servidor y manejamos las solicitudes.
const server = http.createServer((req, res) => {
  // Endpoint para chat vía API de OpenAI.
  if (req.url === '/api/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const userMessage = data.message;

        // Si no existe un thread activo, crear uno nuevo.
        if (!activeThreadId) {
          const thread = await openai.beta.threads.create();
          activeThreadId = thread.id;
        }

        // Agrega el mensaje del usuario al thread existente.
        await openai.beta.threads.messages.create(activeThreadId, {
          role: "user",
          content: userMessage
        });

        // Inicia el run en el thread con streaming de respuesta.
        let replyText = "";
        openai.beta.threads.runs.stream(activeThreadId, {
          assistant_id: "asst_MTmmF7jvBjbKuP5YP2NEci5f"
        })
          .on('textCreated', (text) => {
            // Opcional: acción al iniciar la respuesta.
          })
          .on('textDelta', (textDelta, snapshot) => {
            replyText += textDelta.value;
          })
          .on('toolCallCreated', (toolCall) => {
            // Opcional: manejar eventos de toolCallCreated.
          })
          .on('toolCallDelta', (toolCallDelta, snapshot) => {
            if (toolCallDelta.type === 'code_interpreter') {
              if (toolCallDelta.code_interpreter.input) {
                replyText += toolCallDelta.code_interpreter.input;
              }
              if (toolCallDelta.code_interpreter.outputs) {
                replyText += "\noutput >\n";
                toolCallDelta.code_interpreter.outputs.forEach(output => {
                  if (output.type === "logs") {
                    replyText += `\n${output.logs}\n`;
                  }
                });
              }
            }
          })
          .on('end', () => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ reply: replyText }));
          });
      } catch (err) {
        res.writeHead(500);
        res.end('Error interno del servidor');
      }
    });
    return;
  }

  // Si la ruta solicitada es '/', leemos y enviamos index.html al cliente.
  if (req.url === '/') {
    fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
      if (err) {
        res.writeHead(500);
        return res.end('Error al cargar el archivo');
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } else {
    // Si la ruta no es '/', enviamos código 404.
    res.writeHead(404);
    res.end('Not Found');
  }
});

// Iniciamos el servidor en el puerto 8080 y dirección 0.0.0.0.
const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});