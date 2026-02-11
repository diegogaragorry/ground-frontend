import { Link } from "react-router-dom";
import "../styles/legal.css";

export default function PrivacyPage() {
  return (
    <div className="legal-page">
      <header className="legal-header">
        <Link to="/" className="legal-brand">ground<span className="legal-brand-dot">.</span></Link>
        <Link to="/" className="legal-back">← Volver al inicio</Link>
      </header>

      <main className="legal-main">
        <h1>Política de Privacidad</h1>
        <p className="legal-updated">Última actualización: febrero de 2026</p>

        <section>
          <h2>1. Responsable del tratamiento</h2>
          <p>
            El responsable del tratamiento de los datos personales de los usuarios del servicio <strong>ground.</strong> (en adelante,
            el <strong>«Servicio»</strong>) es el titular de la plataforma (en adelante, el <strong>«Responsable»</strong>, <strong>«nosotros»</strong> o <strong>«nuestro»</strong>).
          </p>
          <p>
            Para ejercer sus derechos en materia de protección de datos o formular consultas sobre esta Política,
            puede contactarnos a través del correo electrónico o medio de contacto indicado en el Sitio.
          </p>
        </section>

        <section>
          <h2>2. Alcance y finalidad</h2>
          <p>
            Esta Política de Privacidad (en adelante, la <strong>«Política»</strong>) describe qué datos personales
            recopilamos, con qué fines los tratamos, durante cuánto tiempo los conservamos y qué derechos le asisten
            al usuario (en adelante, el <strong>«Usuario»</strong> o <strong>«usted»</strong>) en relación con dichos
            tratamientos.
          </p>
          <p>
            La Política se aplica al uso del Servicio, incluyendo el sitio web, las interfaces de usuario y cualquier
            funcionalidad asociada accesible mediante registro o autenticación.
          </p>
        </section>

        <section>
          <h2>3. Datos que recopilamos</h2>
          <p>
            Recopilamos únicamente los datos necesarios para prestar el Servicio y cumplir con nuestras obligaciones
            legales. No realizamos integración ni conexión con entidades bancarias; todos los datos financieros son
            introducidos voluntariamente por el Usuario.
          </p>

          <h3>3.1 Datos de identificación y cuenta</h3>
          <ul>
            <li><strong>Correo electrónico:</strong> para el registro, la autenticación y las comunicaciones relacionadas con el Servicio.</li>
            <li><strong>Contraseña:</strong> almacenada de forma cifrada (hash) para verificar la identidad del Usuario.</li>
          </ul>

          <h3>3.2 Datos financieros y de uso del Servicio</h3>
          <ul>
            <li><strong>Gastos e ingresos:</strong> categorías, montos, monedas, fechas, descripciones y tipo (fijo/variable) que el Usuario registra.</li>
            <li><strong>Presupuestos:</strong> ingresos, gastos base, otros gastos, balances y proyecciones por mes.</li>
            <li><strong>Inversiones:</strong> portafolios, cuentas, capital, movimientos (depósitos, retiros, rendimientos) y snapshots mensuales.</li>
            <li><strong>Categorías y plantillas:</strong> configuraciones de categorías de gastos y plantillas de gastos recurrentes.</li>
            <li><strong>Configuración:</strong> moneda de visualización, preferencias de idioma y ajustes de la cuenta.</li>
          </ul>

          <h3>3.3 Datos técnicos y de uso</h3>
          <ul>
            <li><strong>Dirección IP y datos de conexión:</strong> para la gestión de sesiones, la seguridad y la prevención de fraudes.</li>
            <li><strong>Registros de acceso y uso:</strong> logs de autenticación y actividad en el Servicio para auditoría y soporte técnico.</li>
            <li><strong>Información del navegador y dispositivo:</strong> tipo de navegador, sistema operativo y características técnicas necesarias para el correcto funcionamiento del Servicio.</li>
          </ul>

          <h3>3.4 Cookies y tecnologías similares</h3>
          <p>
            Utilizamos cookies y almacenamiento local necesarias para el funcionamiento del Servicio (por ejemplo,
            sesión de usuario y preferencias). No utilizamos cookies de publicidad ni de seguimiento de terceros para
            fines de marketing.
          </p>
        </section>

        <section>
          <h2>4. Finalidades del tratamiento</h2>
          <p>
            Tratamos sus datos personales para las siguientes finalidades, basadas en los fundamentos jurídicos indicados:
          </p>
          <ul>
            <li><strong>Prestación del Servicio:</strong> gestionar la cuenta, almacenar y procesar sus datos financieros, ofrecer las funcionalidades del producto (dashboard, presupuestos, exportación, etc.). Base legal: ejecución del contrato.</li>
            <li><strong>Seguridad y prevención de fraudes:</strong> proteger la integridad del Servicio, detectar accesos no autorizados y mantener la confidencialidad de los datos. Base legal: interés legítimo.</li>
            <li><strong>Cumplimiento legal:</strong> cumplir con obligaciones impuestas por leyes aplicables (conservación de registros, respuesta a requerimientos de autoridades). Base legal: obligación legal.</li>
            <li><strong>Comunicaciones operativas:</strong> enviar notificaciones esenciales del Servicio (por ejemplo, confirmaciones de registro, cambios en los Términos o la Política, avisos de seguridad). Base legal: ejecución del contrato e interés legítimo.</li>
            <li><strong>Mejora del Servicio:</strong> analizar el uso anónimo o agregado para mejorar la experiencia de usuario y la calidad técnica. Base legal: interés legítimo, cuando se realice de forma no identificable.</li>
          </ul>
          <p>
            No utilizamos sus datos personales para fines de marketing directo ni los vendemos o compartimos con
            terceros con fines comerciales.
          </p>
        </section>

        <section>
          <h2>5. Compartición de datos y terceros</h2>
          <p>
            No vendemos, alquilamos ni comercializamos sus datos personales. Podemos compartir datos únicamente en
            los siguientes supuestos:
          </p>
          <ul>
            <li><strong>Proveedores de servicios:</strong> empresas que nos prestan servicios técnicos necesarios para el funcionamiento del Servicio, como alojamiento (hosting), bases de datos y correo electrónico. Estos proveedores están obligados contractualmente a tratar los datos conforme a nuestras instrucciones y a las medidas de seguridad aplicables.</li>
            <li><strong>Cumplimiento legal:</strong> cuando la ley o una orden judicial o autoridad competente lo exijan, podremos divulgar datos en la medida estrictamente necesaria.</li>
            <li><strong>Protección de derechos:</strong> cuando sea necesario para proteger nuestros derechos, la seguridad del Servicio o de los usuarios, o para investigar infracciones.</li>
          </ul>
          <p>
            El Servicio utiliza infraestructura que puede estar ubicada fuera del país de residencia del Usuario
            (por ejemplo, en servicios cloud como Vercel o Railway). En tal caso, nos aseguramos de que existan
            garantías adecuadas (cláusulas contractuales tipo, decisiones de adecuación u otros mecanismos reconocidos)
            para proteger sus datos conforme a los estándares de protección aplicables.
          </p>
        </section>

        <section>
          <h2>6. Retención de datos</h2>
          <p>
            Conservamos sus datos personales durante el tiempo necesario para las finalidades descritas en esta
            Política:
          </p>
          <ul>
            <li><strong>Datos de cuenta y financieros:</strong> mientras mantenga una cuenta activa. Tras la baja
              de la cuenta, podremos conservar copias por un periodo adicional necesario para cumplimiento legal,
              resolución de disputas o auditoría (por ejemplo, hasta 1-3 años según la legislación aplicable), salvo
              que solicite la eliminación y no exista obligación legal de conservación.</li>
            <li><strong>Logs y datos técnicos:</strong> por el tiempo necesario para seguridad y operación (por ejemplo,
              hasta 12-24 meses), salvo obligaciones legales distintas.</li>
          </ul>
          <p>
            Transcurrido el periodo de retención, los datos serán eliminados o anonimizados de forma segura.
          </p>
        </section>

        <section>
          <h2>7. Seguridad</h2>
          <p>
            Implementamos medidas técnicas y organizativas adecuadas para proteger sus datos frente a accesos no
            autorizados, alteración, divulgación o destrucción, incluyendo:
          </p>
          <ul>
            <li>Cifrado de contraseñas mediante algoritmos seguros (hash).</li>
            <li>Uso de conexiones seguras (HTTPS/TLS) para la transmisión de datos.</li>
            <li>Control de acceso restringido a los sistemas que almacenan datos personales.</li>
            <li>Prácticas de desarrollo seguro y revisión de la infraestructura.</li>
          </ul>
          <p>
            A pesar de estos esfuerzos, ningún método de transmisión o almacenamiento en Internet es totalmente
            infalible. Le recomendamos utilizar contraseñas robustas y no compartir sus credenciales.
          </p>
        </section>

        <section>
          <h2>8. Sus derechos</h2>
          <p>
            De conformidad con la legislación aplicable en materia de protección de datos (incluyendo, cuando
            corresponda, la Ley Nº 18.331 de Protección de Datos Personales de Uruguay y su reglamentación),
            usted tiene derecho a:
          </p>
          <ul>
            <li><strong>Acceso:</strong> conocer si tratamos sus datos y obtener una copia de los mismos.</li>
            <li><strong>Rectificación:</strong> solicitar la corrección de datos inexactos o incompletos.</li>
            <li><strong>Supresión:</strong> solicitar la eliminación de sus datos cuando ya no sean necesarios o
              revoque su consentimiento, salvo que exista obligación legal de conservación.</li>
            <li><strong>Portabilidad:</strong> recibir sus datos en un formato estructurado de uso habitual y
              transmitirlos a otro responsable, cuando sea técnicamente posible.</li>
            <li><strong>Oposición y limitación:</strong> oponerse a determinados tratamientos o solicitar la
              limitación del tratamiento en los supuestos previstos por la ley.</li>
          </ul>
          <p>
            Para ejercer estos derechos, puede contactarnos a través del correo electrónico o medio indicado en
            el Sitio. Responderemos en un plazo razonable conforme a la legislación aplicable.
          </p>
          <p>
            Asimismo, tiene derecho a presentar una reclamación ante la autoridad de control en protección de datos
            de su país. En Uruguay, puede dirigirse a la Agencia de Regulación y Control de Datos Personales (ARCDP)
            o al organismo que en el futuro la sustituya.
          </p>
        </section>

        <section>
          <h2>9. Menores</h2>
          <p>
            El Servicio está dirigido a personas mayores de edad o que tengan capacidad legal para contratar según
            la legislación de su jurisdicción. No recopilamos conscientemente datos de menores de edad. Si tiene
            conocimiento de que un menor ha proporcionado datos personales sin el consentimiento de sus padres o
            tutores, le rogamos que nos lo comunique para proceder a su eliminación.
          </p>
        </section>

        <section>
          <h2>10. Cambios en esta Política</h2>
          <p>
            Podemos actualizar esta Política de forma periódica para reflejar cambios en nuestras prácticas o en
            la legislación aplicable. Las modificaciones sustanciales serán comunicadas mediante aviso visible en
            el Servicio o por correo electrónico, indicando la fecha de la última actualización.
          </p>
          <p>
            Le recomendamos revisar esta Política con periodicidad. El uso continuado del Servicio tras la
            publicación de cambios constituirá su aceptación de la Política modificada.
          </p>
        </section>

        <section>
          <h2>11. Contacto</h2>
          <p>
            Para cualquier consulta relacionada con esta Política de Privacidad o con el ejercicio de sus derechos,
            puede contactarnos a través del correo electrónico o medio indicado en el Sitio.
          </p>
        </section>
      </main>

      <footer className="legal-footer">
        <Link to="/">ground.</Link>
        <span>·</span>
        <Link to="/terms">Términos</Link>
      </footer>
    </div>
  );
}
