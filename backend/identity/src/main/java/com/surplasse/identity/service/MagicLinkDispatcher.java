package com.surplasse.identity.service;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.reactive.ReactiveMailer;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Optional;
import org.jboss.logging.Logger;

@ApplicationScoped
public class MagicLinkDispatcher {

    private static final Logger LOG = Logger.getLogger(MagicLinkDispatcher.class);

    private final ReactiveMailer mailer;

    MagicLinkDispatcher(ReactiveMailer mailer) {
        this.mailer = mailer;
    }

    public void dispatch(Optional<MagicLinkDelivery> delivery) {
        if (delivery.isEmpty()) {
            return;
        }

        MagicLinkDelivery message = delivery.orElseThrow();
        Mail mail = Mail.withText(
                message.recipient(),
                "Votre lien de connexion Surplasse",
                "Bonjour,\n\nVoici votre lien de connexion Surplasse, valable 15 minutes :\n"
                        + message.loginUrl()
                        + "\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n");

        mailer.send(mail)
                .subscribe()
                .with(
                        ignored -> LOG.debugf("Magic link email accepted for session %s.", message.sessionId()),
                        failure -> LOG.errorf(
                                "Magic link email delivery failed for session %s (%s).",
                                message.sessionId(), failure.getClass().getSimpleName()));
    }
}
