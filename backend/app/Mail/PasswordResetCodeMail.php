<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PasswordResetCodeMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $userName,
        public string $code,
        public int $expiresInMinutes,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Your Aluminum Pearl Co. password reset code',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.password-reset-code',
            with: [
                'userName' => $this->userName,
                'code' => $this->code,
                'expiresInMinutes' => $this->expiresInMinutes,
            ],
        );
    }
}
