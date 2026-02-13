import { Link } from "react-router-dom";
import "../styles/legal.css";

export default function TermsPage() {
  return (
    <div className="legal-page">
      <header className="legal-header">
        <Link to="/" className="legal-brand">ground<span className="legal-brand-dot">.</span></Link>
        <Link to="/" className="legal-back">← Volver al inicio</Link>
      </header>

      <main className="legal-main">
        <h1>Términos y Condiciones de Uso del Servicio</h1>
        <p className="legal-updated">Última actualización: febrero de 2026</p>

        <section>
          <h2>1. Objeto y ámbito de aplicación</h2>
          <p>
            Los presentes Términos y Condiciones de Uso (en adelante, los <strong>«Términos»</strong>) regulan el acceso,
            registro y utilización del servicio de gestión de finanzas personales denominado <strong>«ground.»</strong> (en adelante,
            el <strong>«Servicio»</strong> o <strong>«ground.»</strong>), ofrecido a través del sitio web y las interfaces asociadas.
          </p>
          <p>
            El Servicio es proporcionado por el titular de la plataforma (en adelante, el <strong>«Prestador»</strong> o <strong>«nosotros»</strong>).
            Al crear una cuenta, acceder o utilizar el Servicio de cualquier forma, el usuario (en adelante, el <strong>«Usuario»</strong> o
            <strong>«usted»</strong>) manifiesta haber leído, comprendido y aceptado en su totalidad los presentes Términos,
            que constituyen un contrato vinculante entre el Usuario y el Prestador.
          </p>
          <p>
            Si el Usuario no está de acuerdo con cualquiera de las disposiciones aquí contenidas, deberá abstenerse de
            registrarse o utilizar el Servicio.
          </p>
        </section>

        <section>
          <h2>2. Descripción del Servicio</h2>
          <p>
            ground. es una plataforma de software como servicio (SaaS) orientada a la gestión de finanzas personales.
            El Servicio permite al Usuario, entre otras funcionalidades:
          </p>
          <ul>
            <li>Registrar y categorizar gastos e ingresos de forma manual.</li>
            <li>Elaborar y mantener presupuestos mensuales y anuales.</li>
            <li>Realizar el seguimiento de inversiones y patrimonio neto mediante snapshots mensuales.</li>
            <li>Visualizar resúmenes, gráficos y proyecciones financieras.</li>
            <li>Utilizar el cierre de mes para fijar cifras y mantener consistencia contable.</li>
            <li>Exportar datos a formatos CSV o Excel, según el plan contratado.</li>
          </ul>
          <p>
            El Servicio está concebido para uso individual y personal. No constituye asesoramiento financiero, tributario
            ni legal, ni sustituye la consulta a profesionales cualificados en dichas materias.
          </p>
          <p>
            El Servicio no realiza integración ni conexión con entidades bancarias. Todos los datos son ingresados
            manualmente por el Usuario, lo que implica control total sobre la información introducida.
          </p>
        </section>

        <section>
          <h2>3. Registro, cuenta y obligaciones del Usuario</h2>
          <h3>3.1 Requisitos</h3>
          <p>
            Para utilizar el Servicio es necesario crear una cuenta mediante el registro, proporcionando un correo
            electrónico válido y una contraseña que cumpla los requisitos de seguridad indicados en el formulario.
          </p>
          <p>
            Cada persona física debe utilizar una única cuenta. Queda prohibido crear o mantener múltiples cuentas
            asociadas a distintas direcciones de correo electrónico para un mismo usuario natural.
          </p>
          <h3>3.2 Seguridad y confidencialidad</h3>
          <p>
            El Usuario es responsable de mantener la confidencialidad de sus credenciales de acceso (correo electrónico
            y contraseña). Toda actividad realizada bajo su cuenta se presumirá realizada por el Usuario, salvo que
            notifique de manera fehaciente al Prestador la sustracción o uso no autorizado de sus credenciales.
          </p>
          <h3>3.3 Uso individual</h3>
          <p>
            La cuenta es de carácter individual y no transferible. El Usuario no podrá compartir sus credenciales
            con terceros ni permitir el acceso al Servicio por personas no autorizadas. En la actualidad, el Servicio
            no contempla cuentas compartidas o perfiles familiares.
          </p>
        </section>

        <section>
          <h2>4. Uso aceptable y prohibiciones</h2>
          <p>
            El Usuario se compromete a utilizar el Servicio de forma lícita, de buena fe y de conformidad con los
            presentes Términos y con la legislación aplicable.
          </p>
          <p>
            Queda expresamente prohibido:
          </p>
          <ul>
            <li>Utilizar el Servicio para fines ilegales, fraudulentos o contrarios al orden público.</li>
            <li>Introducir datos falsos o engañosos con el propósito de ocultar actividades ilícitas.</li>
            <li>Usar el Servicio con fines comerciales sin autorización previa por escrito del Prestador.</li>
            <li>Realizar ingeniería inversa, descompilación o desensamblado del software del Servicio.</li>
            <li>Emplear sistemas automatizados (bots, scrapers, scripts) para extraer o manipular datos sin autorización.</li>
            <li>Vulnerar la seguridad del Servicio, de otros usuarios o de terceros.</li>
            <li>Subcontratar, alquilar, vender o ceder el acceso al Servicio a terceros.</li>
            <li>Eliminar o alterar avisos de propiedad intelectual, marcas o derechos de autor.</li>
          </ul>
          <p>
            El incumplimiento de estas obligaciones puede dar lugar a la suspensión o terminación inmediata de la
            cuenta, sin perjuicio de las acciones legales que pudieran corresponder.
          </p>
        </section>

        <section>
          <h2>5. Propiedad intelectual y datos del Usuario</h2>
          <h3>5.1 Propiedad del Prestador</h3>
          <p>
            El Prestador es titular o licenciatario de todos los derechos de propiedad intelectual e industrial
            sobre el Servicio, incluyendo el software, la interfaz, la marca «ground.», el diseño y los contenidos
            propios de la plataforma. Nada en los presentes Términos otorga al Usuario derechos sobre dichos elementos
            distintos del derecho limitado y revocable de uso del Servicio conforme a lo aquí dispuesto.
          </p>
          <h3>5.2 Propiedad de los datos del Usuario</h3>
          <p>
            El Usuario conserva la propiedad exclusiva de todos los datos que introduce en el Servicio (gastos,
            ingresos, presupuestos, inversiones y cualquier otra información). El Prestador no adquiere derechos
            de propiedad sobre dichos datos. El tratamiento de los datos personales del Usuario se rige por la
            Política de Privacidad.
          </p>
          <h3>5.3 Licencia limitada de uso</h3>
          <p>
            Mediante la aceptación de estos Términos, el Prestador otorga al Usuario una licencia limitada, no exclusiva,
            intransferible y revocable para acceder y utilizar el Servicio, exclusivamente para uso personal y conforme
            a las funcionalidades disponibles según su plan.
          </p>
        </section>

        <section>
          <h2>6. Planes, precios y facturación</h2>
          <h3>6.1 Early Stage</h3>
          <p>
            En la etapa actual («Early Stage»), los usuarios que se registren tendrán acceso gratuito al Servicio
            durante cuatro (4) meses. Durante ese periodo dispondrán de todas las funcionalidades incluidas en el plan.
          </p>
          <p>
            Transcurrido el periodo gratuito, el Usuario podrá optar por (i) suscribirse al plan de pago Pro, cuando
            esté disponible, o (ii) descargar todos sus datos en formato CSV o Excel antes de que finalice el periodo,
            sin obligación de continuar.
          </p>
          <h3>6.2 Plan Pro (Próximamente)</h3>
          <p>
            El plan Pro se lanzará en una fecha a determinar («Próximamente»). Los usuarios que se registren una vez
            iniciada esa etapa dispondrán de un periodo de prueba gratuito de cuarenta y cinco (45) días, tras el cual
            el Servicio tendrá un costo de USD 3,99 (tres dólares con noventa y nueve centavos estadounidenses) por mes.
          </p>
          <p>
            Los precios podrán ser modificados con previo aviso razonable. El uso continuado del Servicio tras la
            entrada en vigor de una modificación de precios se entenderá como aceptación de la nueva tarifa.
          </p>
          <h3>6.3 Facturación y cancelación</h3>
          <p>
            Los cargos se realizarán según el método de pago indicado por el Usuario. El plan Pro no implica
            permanencia obligatoria; el Usuario podrá cancelar en cualquier momento, manteniendo acceso hasta el
            final del periodo ya facturado.
          </p>
        </section>

        <section>
          <h2>7. Suspensión y terminación</h2>
          <p>
            El Prestador se reserva el derecho de suspender o dar por terminada la cuenta del Usuario, con o sin
            previo aviso, en caso de incumplimiento de estos Términos, por razones de seguridad o por cualquier
            causa que, a juicio del Prestador, justifique dicha medida.
          </p>
          <p>
            El Prestador se reserva asimismo el derecho de discontinuar el Servicio en su totalidad en cualquier
            momento. En caso de cierre definitivo del Servicio, comunicará la decisión con un aviso razonable
            (no inferior a treinta (30) días) y facilitará a los Usuarios la exportación de sus datos antes de la
            cesación efectiva. La limitación de responsabilidad prevista en el apartado 8 será de aplicación.
          </p>
          <p>
            El Usuario podrá dar por terminada su cuenta en cualquier momento solicitando la baja a través de los
            canales habilitados. En tal caso, dispondrá de un plazo razonable para exportar sus datos antes de que
            se proceda a su eliminación definitiva, salvo que la legislación aplicable establezca plazos distintos.
          </p>
          <p>
            Las disposiciones de los apartados 5 (Propiedad intelectual), 8 (Limitación de responsabilidad), 9 (Ley
            aplicable) y 10 (Disposiciones generales) permanecerán vigentes tras la terminación.
          </p>
        </section>

        <section>
          <h2>8. Limitación de responsabilidad</h2>
          <p>
            El Servicio se presta «tal cual» y «según disponibilidad». En la máxima medida permitida por la ley
            aplicable:
          </p>
          <ul>
            <li>El Prestador no garantiza que el Servicio esté libre de errores, interrupciones o que cumpla
              objetivos específicos del Usuario.</li>
            <li>El Prestador no será responsable por daños indirectos, incidentales, especiales o consecuentes,
              incluyendo pérdida de beneficios, datos o oportunidades, derivados del uso o la imposibilidad de uso
              del Servicio.</li>
            <li>La responsabilidad total del Prestador se limitará al monto efectivamente abonado por el Usuario
              en los doce (12) meses anteriores al hecho que haya originado la reclamación, salvo que la ley
              imperativa disponga lo contrario.</li>
            <li>El Prestador no será responsable por daños derivados de accesos no autorizados, hackeos, intrusiones
              o vulnerabilidades explotadas por terceros en el sistema o en la infraestructura que aloja el Servicio,
              cuando tales hechos no sean consecuencia de negligencia grave o dolo del Prestador.</li>
          </ul>
          <p>
            El Servicio no constituye asesoramiento financiero, fiscal ni legal. El Usuario es exclusivamente
            responsable de sus decisiones financieras y del uso que haga de la información generada por el Servicio.
          </p>
        </section>

        <section>
          <h2>9. Modificaciones del Servicio y de los Términos</h2>
          <p>
            El Prestador podrá modificar el Servicio, sus funcionalidades o estos Términos en cualquier momento.
            Durante la etapa inicial del producto, especialmente en fases como «Early Stage», el Prestador se reserva
            el derecho de realizar cambios en el sistema sin obligación de comunicarlos con anticipación al Usuario.
          </p>
          <p>
            Las modificaciones sustanciales, cuando así se requiera, podrán ser comunicadas mediante aviso en el
            Servicio, por correo electrónico o por otros medios adecuados. La ausencia de aviso previo en ciertas
            etapas no invalidará las modificaciones.
          </p>
          <p>
            El uso continuado del Servicio tras la entrada en vigor de modificaciones se entenderá como aceptación
            de las mismas. Si el Usuario no acepta las modificaciones, deberá dejar de utilizar el Servicio y podrá
            solicitar la baja de su cuenta y la exportación de sus datos.
          </p>
        </section>

        <section>
          <h2>10. Ley aplicable y jurisdicción</h2>
          <p>
            Los presentes Términos se rigen por las leyes de la República Oriental del Uruguay, con exclusión de
            sus normas sobre conflictos de leyes.
          </p>
          <p>
            Cualquier controversia derivada de estos Términos o del uso del Servicio será sometida a los tribunales
            competentes de Montevideo, Uruguay, sin perjuicio de que el Prestador pueda ejercer acciones ante los
            tribunales del domicilio del Usuario cuando la ley lo permita.
          </p>
        </section>

        <section>
          <h2>11. Contacto</h2>
          <p>
            Para consultas relativas a estos Términos, puede contactarse a través del correo electrónico o medio
            de contacto indicado en el Sitio o en la Política de Privacidad.
          </p>
        </section>
      </main>

      <footer className="legal-footer">
        <Link to="/">ground.</Link>
        <span>·</span>
        <Link to="/privacy">Privacidad</Link>
      </footer>
    </div>
  );
}
