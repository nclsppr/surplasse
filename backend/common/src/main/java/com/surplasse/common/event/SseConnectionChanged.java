package com.surplasse.common.event;

/** Tracks one authorized subscription entering or leaving an SSE stream. */
public record SseConnectionChanged(Channel channel, boolean connected) {

    public enum Channel {
        ORDER,
        ESTABLISHMENT
    }
}
