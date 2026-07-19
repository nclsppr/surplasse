package com.surplasse.catalog.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.surplasse.catalog.entity.TableQr;
import com.surplasse.catalog.repository.CategoryRepository;
import com.surplasse.catalog.repository.EstablishmentRepository;
import com.surplasse.catalog.repository.MenuRepository;
import com.surplasse.catalog.repository.OptionGroupRepository;
import com.surplasse.catalog.repository.OptionRepository;
import com.surplasse.catalog.repository.ProductRepository;
import com.surplasse.catalog.repository.TableQrRepository;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class CatalogGatewayServiceTest {

    private TableQrRepository tableQrRepository;
    private CatalogGatewayService service;

    @BeforeEach
    void setUp() {
        tableQrRepository = mock(TableQrRepository.class);
        service = new CatalogGatewayService(
                mock(EstablishmentRepository.class),
                tableQrRepository,
                mock(MenuRepository.class),
                mock(CategoryRepository.class),
                mock(ProductRepository.class),
                mock(OptionGroupRepository.class),
                mock(OptionRepository.class));
    }

    @Test
    void findTableLabels_existingTables_returnsLabelsByIdentifier() {
        UUID establishmentId = UUID.randomUUID();
        UUID firstId = UUID.randomUUID();
        UUID secondId = UUID.randomUUID();
        List<UUID> requestedIds = List.of(firstId, secondId);
        when(tableQrRepository.listByIds(requestedIds))
                .thenReturn(List.of(
                        new TableQr(firstId, establishmentId, "Table 1", "T1", true),
                        new TableQr(secondId, establishmentId, "Terrasse 2", "T2", true)));

        Map<UUID, String> result = service.findTableLabels(requestedIds);

        assertEquals(Map.of(firstId, "Table 1", secondId, "Terrasse 2"), result);
        verify(tableQrRepository).listByIds(requestedIds);
    }

    @Test
    void findTableLabels_emptyInput_returnsEmptyMap() {
        assertEquals(Map.of(), service.findTableLabels(List.of()));
        verify(tableQrRepository).listByIds(List.of());
    }
}
