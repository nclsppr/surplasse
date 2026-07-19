package com.surplasse.identity.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "restaurateur")
public class Restaurateur {

    @Id
    private UUID id;

    private String email;
    private String fullName;
    private String phone;
    private Instant lastLoginAt;
    private Instant createdAt;
    private Instant updatedAt;

    protected Restaurateur() {}

    public Restaurateur(UUID id, String email, String fullName, String phone, Instant createdAt) {
        this.id = id;
        this.email = email;
        this.fullName = fullName;
        this.phone = phone;
        this.createdAt = createdAt;
        this.updatedAt = createdAt;
    }

    public void recordLogin(Instant now) {
        lastLoginAt = now;
        updatedAt = now;
    }

    public UUID getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getFullName() {
        return fullName;
    }

    public String getPhone() {
        return phone;
    }

    public Instant getLastLoginAt() {
        return lastLoginAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
