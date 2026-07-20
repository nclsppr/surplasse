package com.surplasse.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.surplasse.catalog.entity.OrderIntakeStatus;
import com.surplasse.catalog.repository.EstablishmentRepository;
import com.surplasse.catalog.service.OrderIntakeService;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.LockSupport;
import org.junit.jupiter.api.Test;

/** Proves that an admission read and an operational pause serialize on the establishment row. */
@QuarkusTest
class OrderIntakeLockingTest {

    private static final UUID ESTABLISHMENT = UUID.fromString("7c9e6679-7425-40de-944b-e07fc1f90ae7");
    private static final UUID RESTAURATEUR = UUID.fromString("a1b2c3d4-e5f6-4789-8abc-def012345678");
    private static final Duration LOCK_WAIT_TIMEOUT = Duration.ofSeconds(5);

    @Inject
    EstablishmentRepository establishmentRepository;

    @Inject
    OrderIntakeService orderIntakeService;

    @Inject
    EntityManager entityManager;

    @Test
    void pauseWaitsForAnAdmissionReadLockBeforeCommitting() throws Exception {
        orderIntakeService.update(ESTABLISHMENT, RESTAURATEUR, OrderIntakeStatus.OPEN);

        CountDownLatch readLockAcquired = new CountDownLatch(1);
        CountDownLatch releaseReadLock = new CountDownLatch(1);
        ArrayBlockingQueue<Integer> writerPid = new ArrayBlockingQueue<>(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        Future<?> reader = null;
        Future<?> writer = null;

        try {
            reader = executor.submit(() -> QuarkusTransaction.requiringNew().run(() -> {
                establishmentRepository.findByIdForAdmission(ESTABLISHMENT).orElseThrow();
                readLockAcquired.countDown();
                await(releaseReadLock);
            }));
            assertTrue(readLockAcquired.await(LOCK_WAIT_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS));

            writer = executor.submit(() -> QuarkusTransaction.requiringNew().run(() -> {
                Number pid = (Number) entityManager
                        .createNativeQuery("select pg_backend_pid()")
                        .getSingleResult();
                put(writerPid, pid.intValue());
                orderIntakeService.update(ESTABLISHMENT, RESTAURATEUR, OrderIntakeStatus.PAUSED);
            }));

            Integer pid = writerPid.poll(LOCK_WAIT_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
            assertNotNull(pid, "The pause transaction did not start");
            assertTrue(awaitDatabaseLock(pid), "The pause transaction never waited on the admission row lock");
            assertFalse(writer.isDone(), "The pause must not commit while an admission read lock is held");

            releaseReadLock.countDown();
            reader.get(LOCK_WAIT_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
            writer.get(LOCK_WAIT_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);

            assertEquals(
                    OrderIntakeStatus.PAUSED,
                    orderIntakeService.get(ESTABLISHMENT, RESTAURATEUR).status());
        } finally {
            releaseReadLock.countDown();
            if (reader != null) {
                reader.cancel(true);
            }
            if (writer != null) {
                writer.cancel(true);
            }
            executor.shutdownNow();
            executor.awaitTermination(LOCK_WAIT_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
            orderIntakeService.update(ESTABLISHMENT, RESTAURATEUR, OrderIntakeStatus.OPEN);
        }
    }

    private boolean awaitDatabaseLock(int pid) {
        long deadline = System.nanoTime() + LOCK_WAIT_TIMEOUT.toNanos();
        while (System.nanoTime() < deadline) {
            String waitEventType = QuarkusTransaction.requiringNew().call(() -> (String) entityManager
                    .createNativeQuery("select wait_event_type from pg_stat_activity where pid = :pid")
                    .setParameter("pid", pid)
                    .getSingleResult());
            if ("Lock".equals(waitEventType)) {
                return true;
            }
            LockSupport.parkNanos(Duration.ofMillis(10).toNanos());
        }
        return false;
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(LOCK_WAIT_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS)) {
                throw new IllegalStateException("Timed out while holding the admission lock");
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while holding the admission lock", exception);
        }
    }

    private static void put(ArrayBlockingQueue<Integer> queue, int value) {
        try {
            queue.put(value);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted before attempting the pause", exception);
        }
    }
}
