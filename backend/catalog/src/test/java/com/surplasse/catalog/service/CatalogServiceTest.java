package com.surplasse.catalog.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.surplasse.catalog.entity.Category;
import com.surplasse.catalog.entity.Establishment;
import com.surplasse.catalog.entity.EstablishmentStatus;
import com.surplasse.catalog.entity.Menu;
import com.surplasse.catalog.entity.MenuStatus;
import com.surplasse.catalog.entity.Option;
import com.surplasse.catalog.entity.OptionGroup;
import com.surplasse.catalog.entity.Product;
import com.surplasse.catalog.repository.CategoryRepository;
import com.surplasse.catalog.repository.EstablishmentRepository;
import com.surplasse.catalog.repository.MenuRepository;
import com.surplasse.catalog.repository.OptionGroupRepository;
import com.surplasse.catalog.repository.OptionRepository;
import com.surplasse.catalog.repository.ProductRepository;
import com.surplasse.catalog.repository.TableQrRepository;
import com.surplasse.common.error.NotFoundException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class CatalogServiceTest {

    private EstablishmentRepository establishmentRepository;
    private MenuRepository menuRepository;
    private CategoryRepository categoryRepository;
    private ProductRepository productRepository;
    private OptionGroupRepository optionGroupRepository;
    private OptionRepository optionRepository;
    private TableQrRepository tableQrRepository;
    private CatalogService service;

    private final UUID establishmentId = UUID.randomUUID();
    private final UUID menuId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        establishmentRepository = mock(EstablishmentRepository.class);
        menuRepository = mock(MenuRepository.class);
        categoryRepository = mock(CategoryRepository.class);
        productRepository = mock(ProductRepository.class);
        optionGroupRepository = mock(OptionGroupRepository.class);
        optionRepository = mock(OptionRepository.class);
        tableQrRepository = mock(TableQrRepository.class);
        service = new CatalogService(
                establishmentRepository,
                menuRepository,
                categoryRepository,
                productRepository,
                optionGroupRepository,
                optionRepository,
                tableQrRepository);
    }

    @Test
    void activeEstablishmentBySlug_unknownSlug_throwsNotFound() {
        when(establishmentRepository.findActiveBySlug("nulle-part")).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> service.activeEstablishmentBySlug("nulle-part"));
    }

    @Test
    void publishedMenuBySlug_noPublishedMenu_throwsNotFound() {
        givenActiveEstablishment();
        when(menuRepository.findPublishedByEstablishment(establishmentId)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> service.publishedMenuBySlug("le-cormoran"));
    }

    @Test
    void publishedMenuBySlug_menuTree_groupsChildrenUnderParentsInOrder() {
        givenActiveEstablishment();
        Menu menu = new Menu(menuId, establishmentId, "Carte principale", MenuStatus.PUBLISHED);
        when(menuRepository.findPublishedByEstablishment(establishmentId)).thenReturn(Optional.of(menu));

        Category starters = new Category(UUID.randomUUID(), menuId, "Entrées", 1);
        Category mains = new Category(UUID.randomUUID(), menuId, "Plats", 2);
        Product soup = new Product(UUID.randomUUID(), starters.getId(), "Soupe", null, 850, false, 1);
        Product burger = new Product(UUID.randomUUID(), mains.getId(), "Burger", null, 1600, true, 1);
        OptionGroup doneness = new OptionGroup(UUID.randomUUID(), burger.getId(), "Cuisson", 1, 1, 1);
        Option rare = new Option(UUID.randomUUID(), doneness.getId(), "Saignant", 0, true, 1);

        when(categoryRepository.listByMenuOrdered(menuId)).thenReturn(List.of(starters, mains));
        when(productRepository.listVisibleByCategories(anyList())).thenReturn(List.of(soup, burger));
        when(optionGroupRepository.listByProductsOrdered(anyList())).thenReturn(List.of(doneness));
        when(optionRepository.listVisibleByGroupsOrdered(anyList())).thenReturn(List.of(rare));

        MenuSnapshot snapshot = service.publishedMenuBySlug("le-cormoran");

        assertEquals("EUR", snapshot.currency());
        assertEquals(
                List.of("Entrées", "Plats"),
                snapshot.categories().stream()
                        .map(category -> category.category().getName())
                        .toList());
        MenuSnapshot.CategorySnapshot startersSnapshot = snapshot.categories().get(0);
        assertEquals(1, startersSnapshot.products().size());
        assertTrue(startersSnapshot.products().get(0).optionGroups().isEmpty());
        MenuSnapshot.ProductSnapshot burgerSnapshot =
                snapshot.categories().get(1).products().get(0);
        assertEquals("Cuisson", burgerSnapshot.optionGroups().get(0).group().getName());
        assertEquals(
                "Saignant",
                burgerSnapshot.optionGroups().get(0).options().get(0).getName());
    }

    @Test
    void publishedMenuBySlug_emptyMenu_returnsNoCategories() {
        givenActiveEstablishment();
        Menu menu = new Menu(menuId, establishmentId, "Carte principale", MenuStatus.PUBLISHED);
        when(menuRepository.findPublishedByEstablishment(establishmentId)).thenReturn(Optional.of(menu));
        when(categoryRepository.listByMenuOrdered(menuId)).thenReturn(List.of());
        when(productRepository.listVisibleByCategories(anyList())).thenReturn(List.of());
        when(optionGroupRepository.listByProductsOrdered(anyList())).thenReturn(List.of());
        when(optionRepository.listVisibleByGroupsOrdered(anyList())).thenReturn(List.of());

        MenuSnapshot snapshot = service.publishedMenuBySlug("le-cormoran");

        assertTrue(snapshot.categories().isEmpty());
    }

    private void givenActiveEstablishment() {
        Establishment establishment = new Establishment(
                establishmentId, null, "Le Cormoran", "le-cormoran", null, EstablishmentStatus.ACTIVE);
        when(establishmentRepository.findActiveBySlug(any())).thenReturn(Optional.of(establishment));
    }
}
